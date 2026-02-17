import { firestore } from "@/config/firebase";
import { ResponseType } from "@/types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  createTransferTransaction,
  deleteTransferTransactions,
} from "@/services/transactionService";
import { ensureSystemWallets, SYSTEM_WALLET_IDS } from "./walletService";

export type DebtKind = "HUTANG" | "PIUTANG";
export type DebtStatus = "ONGOING" | "PAID";

export type DebtDoc = {
  uid: string;
  kind: DebtKind;
  personName: string;
  title?: string;
  note?: string;
  amount: number;
  paidAmount: number;
  status: DebtStatus;
  walletId: string;
  date?: Date | null;
  dueDate?: Date | null;
  created: any;
  updated: any;
  initialTransferId?: string;
};

type PaymentDoc = {
  uid: string;
  amount: number;
  walletId: string;
  date: Date;
  note?: string;
  created: any;
  transferId?: string;
};

const debtsCol = collection(firestore, "debts");
const safeMsg = (e: any, fallback: string) => e?.message || fallback;
const oneLine = (v?: string) => String(v ?? "").replace(/\s+/g, " ").trim();

const buildDebtTxDescription = (args: {
  tag: "DEBT" | "PAYMENT";
  debtId: string;
  personName?: string;
  note?: string;
}) => {
  const person = oneLine(args.personName) || "Someone";
  const note = oneLine(args.note) || "-";
  return `[${args.tag}:${args.debtId}] ${person} - ${note}`;
};

const collectDebtTransferIds = async (uid: string, debtId: string) => {
  const txQ = query(collection(firestore, "transactions"), where("uid", "==", uid));

  const txSnap = await getDocs(txQ);
  const ids = new Set<string>();
  const debtPrefix = `[DEBT:${debtId}]`;
  const paymentPrefix = `[PAYMENT:${debtId}]`;

  txSnap.forEach((txDoc) => {
    const tx = txDoc.data() as any;
    if (tx?.isTransfer !== true) return;

    const desc = String(tx?.description ?? "");
    const transferId = String(tx?.transferId ?? "");
    if (!transferId) return;

    if (desc.startsWith(debtPrefix) || desc.startsWith(paymentPrefix)) {
      ids.add(transferId);
    }
  });

  return ids;
};

/**
 * Create debt:
 * - PIUTANG (I Lent): wallet -> receivable
 * - HUTANG  (I Borrowed): payable -> wallet
 */
export const createDebt = async (args: {
  uid: string;
  kind: DebtKind;
  personName: string;
  amount: number;
  walletId: string;
  date: Date;
  dueDate?: Date | null;
  title?: string;
  note?: string;
}): Promise<ResponseType & { debtId?: string }> => {
  try {
    const { uid, kind, personName, amount, walletId, date, dueDate, title, note } =
      args;

    if (!uid) return { success: false, msg: "User tidak valid" };
    if (!personName?.trim()) return { success: false, msg: "Nama orang wajib diisi" };
    if (!walletId) return { success: false, msg: "Wallet wajib dipilih" };
    if (!amount || amount <= 0) return { success: false, msg: "Amount tidak valid" };

    await ensureSystemWallets(uid);
    const sys = SYSTEM_WALLET_IDS(uid);

    const debtRef = await addDoc(debtsCol, {
      uid,
      kind,
      personName: personName.trim(),
      title: title ?? "",
      note: note ?? "",
      amount,
      paidAmount: 0,
      status: "ONGOING",
      walletId,
      date,
      dueDate: dueDate ?? null,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    });

    const debtId = debtRef.id;
    const fromWalletId = kind === "PIUTANG" ? walletId : sys.payable;
    const toWalletId = kind === "PIUTANG" ? sys.receivable : walletId;

    const transferRes = await createTransferTransaction({
      uid,
      fromWalletId,
      toWalletId,
      amount,
      date,
      description: buildDebtTxDescription({
        tag: "DEBT",
        debtId,
        personName,
        note,
      }),
    });

    if (!transferRes.success) {
      await deleteDoc(debtRef);
      return { success: false, msg: transferRes.msg };
    }

    const initialTransferId = String(transferRes.data?.transferId ?? "");

    await updateDoc(debtRef, {
      updated: serverTimestamp(),
      ...(initialTransferId ? { initialTransferId } : {}),
    });

    return { success: true, msg: "Debt berhasil dibuat", debtId };
  } catch (e: any) {
    return { success: false, msg: safeMsg(e, "Gagal membuat debt") };
  }
};

/**
 * Add payment:
 * - PIUTANG: receivable -> wallet (wallet pilihan user)
 * - HUTANG : wallet -> payable
 */
export const addDebtPayment = async (args: {
  uid: string;
  debtId: string;
  amount: number;
  walletId: string;
  date: Date;
  note?: string;
}): Promise<ResponseType> => {
  try {
    const { uid, debtId, amount, walletId, date, note } = args;

    if (!uid) return { success: false, msg: "User tidak valid" };
    if (!debtId) return { success: false, msg: "Debt tidak valid" };
    if (!walletId) return { success: false, msg: "Wallet wajib dipilih" };
    if (!amount || amount <= 0) return { success: false, msg: "Amount payment tidak valid" };

    await ensureSystemWallets(uid);
    const sys = SYSTEM_WALLET_IDS(uid);
    const debtRef = doc(firestore, "debts", debtId);

    const debtSnap = await getDoc(debtRef);
    if (!debtSnap.exists()) return { success: false, msg: "Debt tidak ditemukan" };

    const debt = debtSnap.data() as DebtDoc;
    if (debt.uid !== uid) return { success: false, msg: "Debt bukan milik user" };
    if (debt.status === "PAID") return { success: false, msg: "Debt sudah lunas" };

    const remaining = Number(debt.amount ?? 0) - Number(debt.paidAmount ?? 0);
    if (amount > remaining) return { success: false, msg: "Payment melebihi sisa hutang/piutang" };

    const fromWalletId = debt.kind === "PIUTANG" ? sys.receivable : walletId;
    const toWalletId = debt.kind === "PIUTANG" ? walletId : sys.payable;

    const transferRes = await createTransferTransaction({
      uid,
      fromWalletId,
      toWalletId,
      amount,
      date,
      description: buildDebtTxDescription({
        tag: "PAYMENT",
        debtId,
        personName: debt.personName,
        note: oneLine(note) || oneLine(debt.note),
      }),
    });

    if (!transferRes.success) return transferRes;
    const transferId = String(transferRes.data?.transferId ?? "");

    try {
      await runTransaction(firestore, async (t) => {
        const fresh = await t.get(debtRef);
        if (!fresh.exists()) throw new Error("Debt tidak ditemukan");

        const d = fresh.data() as DebtDoc;
        const freshRemaining = Number(d.amount ?? 0) - Number(d.paidAmount ?? 0);
        if (amount > freshRemaining) {
          throw new Error("Payment melebihi sisa hutang/piutang");
        }

        const newPaid = Number(d.paidAmount ?? 0) + amount;
        const newStatus: DebtStatus = newPaid >= Number(d.amount ?? 0) ? "PAID" : "ONGOING";

        t.update(debtRef, {
          paidAmount: newPaid,
          status: newStatus,
          updated: serverTimestamp(),
        });

        const payRef = doc(collection(firestore, "debts", debtId, "payments"));
        t.set(payRef, {
          uid,
          amount,
          walletId,
          date,
          note: note ?? "",
          ...(transferId ? { transferId } : {}),
          created: serverTimestamp(),
        });
      });
    } catch (err: any) {
      if (transferId) {
        await deleteTransferTransactions(transferId);
      }
      throw err;
    }

    return { success: true, msg: "Payment berhasil" };
  } catch (e: any) {
    return { success: false, msg: safeMsg(e, "Gagal menambah payment") };
  }
};

/**
 * Update debt metadata. Financial fields (kind, amount, wallet) sengaja tidak diubah di sini
 * untuk mencegah mismatch saldo transfer yang sudah tercatat.
 */
export const updateDebt = async (args: {
  uid: string;
  debtId: string;
  kind: DebtKind;
  amount: number;
  walletId: string;
  personName: string;
  title?: string;
  note?: string;
  dueDate?: Date | null;
}): Promise<ResponseType> => {
  try {
    const { uid, debtId, kind, amount, walletId, personName, title, note, dueDate } =
      args;

    if (!uid) return { success: false, msg: "User tidak valid" };
    if (!debtId) return { success: false, msg: "Debt tidak valid" };
    if (!personName?.trim()) return { success: false, msg: "Nama orang wajib diisi" };

    const debtRef = doc(firestore, "debts", debtId);
    const debtSnap = await getDoc(debtRef);
    if (!debtSnap.exists()) return { success: false, msg: "Debt tidak ditemukan" };

    const debt = debtSnap.data() as DebtDoc;
    if (debt.uid !== uid) return { success: false, msg: "Debt bukan milik user" };

    const financialChanged =
      kind !== debt.kind ||
      Number(amount ?? 0) !== Number(debt.amount ?? 0) ||
      String(walletId ?? "") !== String(debt.walletId ?? "");

    if (financialChanged) {
      return {
        success: false,
        msg: "Edit jenis/amount/wallet belum didukung. Buat debt baru untuk perubahan ini.",
      };
    }

    await updateDoc(debtRef, {
      personName: personName.trim(),
      title: title ?? "",
      note: note ?? "",
      dueDate: dueDate ?? null,
      updated: serverTimestamp(),
    });

    return { success: true, msg: "Debt berhasil diupdate" };
  } catch (e: any) {
    return { success: false, msg: safeMsg(e, "Gagal update debt") };
  }
};

/**
 * Delete debt + rollback seluruh transfer (initial + payment) agar saldo tetap konsisten.
 */
export const deleteDebt = async (args: {
  debtId: string;
  uid?: string;
}): Promise<ResponseType> => {
  try {
    const { debtId, uid } = args;
    if (!debtId) return { success: false, msg: "Debt tidak valid" };

    const debtRef = doc(firestore, "debts", debtId);
    const debtSnap = await getDoc(debtRef);
    if (!debtSnap.exists()) return { success: false, msg: "Debt tidak ditemukan" };

    const debt = debtSnap.data() as DebtDoc;
    if (uid && debt.uid !== uid) return { success: false, msg: "Debt bukan milik user" };

    const transferIds = new Set<string>();
    if (debt.initialTransferId) transferIds.add(debt.initialTransferId);

    const paymentsRef = collection(firestore, "debts", debtId, "payments");
    const paymentsSnap = await getDocs(paymentsRef);

    paymentsSnap.forEach((payDoc) => {
      const pay = payDoc.data() as PaymentDoc;
      if (pay.transferId) transferIds.add(pay.transferId);
    });

    const fallbackIds = await collectDebtTransferIds(debt.uid, debtId);
    fallbackIds.forEach((id) => transferIds.add(id));

    for (const transferId of transferIds) {
      const rollback = await deleteTransferTransactions(transferId);
      if (!rollback.success) {
        return {
          success: false,
          msg: `Rollback transfer gagal (${transferId}): ${rollback.msg}`,
        };
      }
    }

    const batch = writeBatch(firestore);
    paymentsSnap.forEach((payDoc) => batch.delete(payDoc.ref));
    batch.delete(debtRef);
    await batch.commit();

    return { success: true, msg: "Debt berhasil dihapus" };
  } catch (e: any) {
    return { success: false, msg: safeMsg(e, "Gagal hapus debt") };
  }
};
