import { firestore } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { ResponseType, TransactionType, WalletType } from "@/types";
import { getLast12Months, getLast7Days, getYearsRange } from "@/utils/common";
import { scale } from "@/utils/styling";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";
import { createOrUpdateWallet } from "./walletService";

export const createOrUpdateTransaction = async (
  transactionData: Partial<TransactionType>,
): Promise<ResponseType> => {
  try {
    const { id, type, walletId, amount, image } = transactionData;
    if (!amount || amount <= 0 || !walletId || !type) {
      return { success: false, msg: "Invalid transaction data!" };
    }
    if (id) {
      const oldTransactionSnapshot = await getDoc(
        doc(firestore, "transactions", id),
      );
      const oldTransaction = oldTransactionSnapshot.data() as TransactionType;
      const shouldRevertOriginal =
        oldTransaction.type != type ||
        oldTransaction.amount != amount ||
        oldTransaction.walletId != walletId;
      if (shouldRevertOriginal) {
        let res = await revertAndUpdateWallet(
          oldTransaction,
          Number(amount),
          type,
          walletId,
        );
        if (!res.success) return res;
      }
    } else {
      // update wallet fot new trans
      let res = await updateWalletForNewTransaction(
        walletId!,
        Number(amount!),
        type,
      );
      if (!res.success) return res;
    }

    if (image) {
      const imageUploadRes = await uploadFileToCloudinary(
        image,
        "transactions",
      );
      if (!imageUploadRes.success) {
        return {
          success: false,
          msg: imageUploadRes.msg || "Failed to upload receipt",
        };
      }
      transactionData.image = imageUploadRes.data;
    }

    const transactionRef = id
      ? doc(firestore, "transactions", id)
      : doc(collection(firestore, "transactions"));

    await setDoc(transactionRef, transactionData, { merge: true });

    return {
      success: true,
      data: { ...transactionData, id: transactionRef.id },
    };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

const updateWalletForNewTransaction = async (
  walletId: string,
  amount: number,
  type: string,
) => {
  try {
    const walletRef = doc(firestore, "wallets", walletId);
    const walletSnapshot = await getDoc(walletRef);
    if (!walletSnapshot.exists()) {
      return { success: false, msg: "Wallet not found" };
    }

    const walletData = walletSnapshot.data() as WalletType;

    if (type == "expense" && walletData.amount! - amount < 0) {
      return {
        success: false,
        msg: "Selected wallet don't have enough balance",
      };
    }

    const updateType = type == "income" ? "totalIncome" : "totalExpenses";
    const updatedWalletAmount =
      type == "income"
        ? Number(walletData.amount) + amount
        : Number(walletData.amount) - amount;

    const updatedTotals =
      type == "income"
        ? Number(walletData.totalIncome) + amount
        : Number(walletData.totalExpenses) + amount;

    await updateDoc(walletRef, {
      amount: updatedWalletAmount,
      [updateType]: updatedTotals,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

const revertAndUpdateWallet = async (
  oldTransaction: TransactionType,
  newTransactionAmount: number,
  newTransactionType: string,
  newWalletId: string,
) => {
  try {
    const originalWalletSnapshot = await getDoc(
      doc(firestore, "wallets", oldTransaction.walletId),
    );

    const originalWallet = originalWalletSnapshot.data() as WalletType;

    let newWalletSnapshot = await getDoc(
      doc(firestore, "wallets", newWalletId),
    );
    let newWallet = newWalletSnapshot.data() as WalletType;

    const revertType =
      oldTransaction.type == "income" ? "totalIncome" : "totalExpenses";
    const revertIncomeExpenses: number =
      oldTransaction.type == "income"
        ? -Number(oldTransaction.amount)
        : Number(oldTransaction.amount);

    const revertedWalletAmount =
      Number(originalWallet.amount) + revertIncomeExpenses;

    const revertedIncomeExpenseAmount =
      Number(originalWallet[revertType]) - Number(oldTransaction.amount);

    if (newTransactionType == "expense") {
      if (
        oldTransaction.walletId == newWalletId &&
        revertedWalletAmount < newTransactionAmount
      ) {
        return {
          success: false,
          msg: "The selected wallet don`t have enough balance",
        };
      }
      if (newWallet.amount! < newTransactionAmount) {
        return {
          success: false,
          msg: "The selected wallet don`t have enough balance",
        };
      }
    }

    await createOrUpdateWallet({
      id: oldTransaction.walletId,
      amount: revertedWalletAmount,
      [revertType]: revertedIncomeExpenseAmount,
    });

    // refetch

    newWalletSnapshot = await getDoc(doc(firestore, "wallets", newWalletId));
    newWallet = newWalletSnapshot.data() as WalletType;

    const updateType =
      newTransactionType == "income" ? "totalIncome" : "totalExpenses";

    const updatedTransactionAmount: number =
      newTransactionType == "income"
        ? Number(newTransactionAmount)
        : -Number(newTransactionAmount);

    const newWalletAmount = Number(newWallet.amount) + updatedTransactionAmount;

    const newIncomeExpenseAmount = Number(
      Number(newWallet[updateType])! + Number(newTransactionAmount),
    );

    await createOrUpdateWallet({
      id: newWalletId,
      amount: newWalletAmount,
      [updateType]: newIncomeExpenseAmount,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const deleteTransaction = async (
  transactionId: string,
  walletId: string,
) => {
  try {
    const transactionRef = doc(firestore, "transactions", transactionId);
    const transactionSnapshot = await getDoc(transactionRef);

    if (!transactionSnapshot.exists()) {
      return { success: false, msg: "Transaction not found" };
    }
    const transactionData = transactionSnapshot.data() as TransactionType;

    const transactionType = transactionData?.type;
    const transactionAmount = transactionData?.amount;

    const walletSnapshot = await getDoc(doc(firestore, "wallets", walletId));
    const walletData = walletSnapshot.data() as WalletType;

    const updateType =
      transactionType == "income" ? "totalIncome" : "totalExpenses";
    const newWalletAmount =
      walletData?.amount! -
      (transactionType == "income" ? transactionAmount : -transactionAmount);

    const newIncomeExpenseAmount = walletData[updateType]! - transactionAmount;

    if (transactionType == "expense" && newWalletAmount < 0) {
      return { success: false, msg: "You cannot delete this transaction" };
    }

    await createOrUpdateWallet({
      id: walletId,
      amount: newWalletAmount,
      [updateType]: newIncomeExpenseAmount,
    });

    await deleteDoc(transactionRef);
    return { success: true };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const fetchWeeklyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const db = firestore;
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const transactionsQuery = query(
      collection(db, "transactions"),
      where("date", ">=", Timestamp.fromDate(sevenDaysAgo)),
      where("date", "<=", Timestamp.fromDate(today)),
      orderBy("date", "desc"),
      where("uid", "==", uid),
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const weeklyData = getLast7Days();
    const transactions: TransactionType[] = [];

    querySnapshot.forEach((doc) => {
      const transaction = doc.data() as TransactionType;
      transaction.id = doc.id;
      transactions.push(transaction);

      const transactionDate = (transaction.date as Timestamp)
        .toDate()
        .toISOString()
        .split("T")[0];

      const dayData = weeklyData.find((day) => day.date == transactionDate);

      if (dayData) {
        if (transaction.type == "income") {
          dayData.income += transaction.amount;
        } else if (transaction.type == "expense") {
          dayData.expense += transaction.amount;
        }
      }
    });

    const stats = weeklyData.flatMap((day) => [
      {
        value: day.income,
        label: day.day,
        spacing: scale(4),
        labelWidth: scale(30),
        frontColor: colors.primary,
      },
      { value: day.expense, frontColor: colors.rose },
    ]);

    return {
      success: true,
      data: {
        stats,
        transactions,
      },
    };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const fetchMonthlyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const db = firestore;
    const today = new Date();
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setMonth(today.getMonth() - 12);

    const transactionsQuery = query(
      collection(db, "transactions"),
      where("date", ">=", Timestamp.fromDate(twelveMonthsAgo)),
      where("date", "<=", Timestamp.fromDate(today)),
      orderBy("date", "desc"),
      where("uid", "==", uid),
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const monthlyData = getLast12Months();
    const transactions: TransactionType[] = [];

    querySnapshot.forEach((doc) => {
      const transaction = doc.data() as TransactionType;
      transaction.id = doc.id;
      transactions.push(transaction);

      const transactionDate = (transaction.date as Timestamp).toDate();
      const MonthName = transactionDate.toLocaleString("default", {
        month: "short",
      });
      const shortYear = transactionDate.getFullYear().toString().slice(-2);
      const monthData = monthlyData.find(
        (month) => month.month === `${MonthName} ${shortYear}`,
      );

      if (monthData) {
        if (transaction.type === "income") {
          monthData.income += transaction.amount;
        } else if (transaction.type === "expense") {
          monthData.expense += transaction.amount;
        }
      }
    });

    const stats = monthlyData.flatMap((month) => [
      {
        value: month.income,
        label: month.month,
        spacing: scale(4),
        labelWidth: scale(46),
        frontColor: colors.primary,
      },
      { value: month.expense, frontColor: colors.rose },
    ]);

    return {
      success: true,
      data: {
        stats,
        transactions,
      },
    };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const fetchYearlyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const db = firestore;

    const transactionsQuery = query(
      collection(db, "transactions"),
      orderBy("date", "desc"),
      where("uid", "==", uid),
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const transactions: TransactionType[] = [];

    const firstTransactions = querySnapshot.docs.reduce((earliest, doc) => {
      const transactionDate = doc.data().date.toDate();
      return transactionDate < earliest ? transactionDate : earliest;
    }, new Date());

    const firstYear = firstTransactions.getFullYear();
    const currentYear = new Date().getFullYear();

    const yearlyData = getYearsRange(firstYear, currentYear);

    querySnapshot.forEach((doc) => {
      const transaction = doc.data() as TransactionType;
      transaction.id = doc.id;
      transactions.push(transaction);

      const transactionYear = (transaction.date as Timestamp)
        .toDate()
        .getFullYear();
      const yearData = yearlyData.find(
        (item: any) => item.year === transactionYear.toString(),
      );

      if (yearData) {
        if (transaction.type === "income") {
          yearData.income += transaction.amount;
        } else if (transaction.type === "expense") {
          yearData.expense += transaction.amount;
        }
      }
    });

    const stats = yearlyData.flatMap((year: any) => [
      {
        value: year.income,
        label: year.year,
        spacing: scale(4),
        labelWidth: scale(46),
        frontColor: colors.primary,
      },
      { value: year.expense, frontColor: colors.rose },
    ]);

    return {
      success: true,
      data: {
        stats,
        transactions,
      },
    };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const createTransferTransaction = async (args: {
  uid: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  date: Date;
  description?: string;
}): Promise<ResponseType> => {
  try {
    const { uid, fromWalletId, toWalletId, amount, date, description } = args;

    if (!uid) return { success: false, msg: "User tidak valid" };
    if (!fromWalletId || !toWalletId)
      return { success: false, msg: "Wallet transfer belum dipilih" };
    if (fromWalletId === toWalletId)
      return { success: false, msg: "From & To wallet tidak boleh sama" };
    if (!amount || amount <= 0)
      return { success: false, msg: "Amount transfer tidak valid" };

    const fromRef = doc(firestore, "wallets", fromWalletId);
    const toRef = doc(firestore, "wallets", toWalletId);

    const txCol = collection(firestore, "transactions");
    const expenseRef = doc(txCol); // auto id
    const incomeRef = doc(txCol); // auto id

    const transferId = `${expenseRef.id}_${incomeRef.id}`; // buat linking

    await runTransaction(firestore, async (t) => {
      // --- validate wallets exist + uid match (opsional tapi recommended)
      const fromSnap = await t.get(fromRef);
      const toSnap = await t.get(toRef);

      if (!fromSnap.exists()) throw new Error("From wallet tidak ditemukan");
      if (!toSnap.exists()) throw new Error("To wallet tidak ditemukan");

      const fromWallet = fromSnap.data() as WalletType;
      const toWallet = toSnap.data() as WalletType;

      if (fromWallet.uid !== uid || toWallet.uid !== uid)
        throw new Error("Wallet bukan milik user");

      // --- cek saldo cukup (kalau kamu mau boleh dihapus)
      const fromAmount = Number(fromWallet.amount ?? 0);
      if (fromAmount < amount) throw new Error("Saldo from wallet tidak cukup");

      // --- update balances (atomic)
      t.update(fromRef, { amount: increment(-amount) });
      t.update(toRef, { amount: increment(amount) });

      // --- create 2 transactions (expense + income) linked by transferId
      // note: category dikosongin biar gak ganggu rule expense
      t.set(expenseRef, {
        uid,
        type: "expense",
        amount,
        category: "",
        description: description ?? "",
        date,
        walletId: fromWalletId,
        image: null,

        // metadata transfer
        isTransfer: true,
        transferId,
        transferSide: "out",
        transferFromId: fromWalletId,
        transferToId: toWalletId,

        created: serverTimestamp(),
      });

      t.set(incomeRef, {
        uid,
        type: "income",
        amount,
        category: "",
        description: description ?? "",
        date,
        walletId: toWalletId,
        image: null,

        // metadata transfer
        isTransfer: true,
        transferId,
        transferSide: "in",
        transferFromId: fromWalletId,
        transferToId: toWalletId,

        created: serverTimestamp(),
      });
    });

    return { success: true, msg: "Transfer sukses" };
  } catch (e: any) {
    return { success: false, msg: e?.message || "Transfer gagal" };
  }
};

export const deleteTransferTransactions = async (
  transferId: string,
): Promise<ResponseType> => {
  try {
    if (!transferId) return { success: false, msg: "Invalid transferId" };

    const parts = transferId.split("_");
    if (parts.length !== 2)
      return { success: false, msg: "transferId format invalid" };

    const [outId, inId] = parts;

    const outRef = doc(firestore, "transactions", outId);
    const inRef = doc(firestore, "transactions", inId);

    await runTransaction(firestore, async (t) => {
      const outSnap = await t.get(outRef);
      const inSnap = await t.get(inRef);

      const outTx = outSnap.exists() ? (outSnap.data() as any) : null;
      const inTx = inSnap.exists() ? (inSnap.data() as any) : null;

      // minimal salah satu harus ada
      const base = outTx ?? inTx;
      if (!base) throw new Error("Transfer pair not found");

      const fromWalletId = base.transferFromId;
      const toWalletId = base.transferToId;
      const amount = Number(base.amount ?? 0);

      if (!fromWalletId || !toWalletId) {
        throw new Error("Transfer wallet data missing");
      }
      if (!amount || amount <= 0) {
        throw new Error("Transfer amount invalid");
      }

      const fromRef = doc(firestore, "wallets", fromWalletId);
      const toRef = doc(firestore, "wallets", toWalletId);

      const fromWalletSnap = await t.get(fromRef);
      const toWalletSnap = await t.get(toRef);

      if (!fromWalletSnap.exists()) throw new Error("From wallet not found");
      if (!toWalletSnap.exists()) throw new Error("To wallet not found");

      // ✅ revert saldo (kebalikan dari transfer):
      // awalnya: from -amount, to +amount
      // delete:  from +amount, to -amount
      t.update(fromRef, { amount: increment(amount) });
      t.update(toRef, { amount: increment(-amount) });

      // ✅ delete dua transaksi (yang ada aja)
      if (outSnap.exists()) t.delete(outRef);
      if (inSnap.exists()) t.delete(inRef);
    });

    return { success: true, msg: "Transfer deleted" };
  } catch (e: any) {
    return { success: false, msg: e?.message || "Failed to delete transfer" };
  }
};
