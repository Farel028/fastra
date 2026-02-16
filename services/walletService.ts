import { firestore } from "@/config/firebase";
import { ResponseType, WalletType } from "@/types";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";

export const createOrUpdateWallet = async (
  walletData: Partial<WalletType>,
): Promise<ResponseType> => {
  try {
    let walletToSave = { ...walletData };

    if (walletData.image) {
      const imageUploadRes = await uploadFileToCloudinary(
        walletData.image,
        "wallets",
      );
      if (!imageUploadRes.success) {
        return {
          success: false,
          msg: imageUploadRes.msg || "Failed to upload wallet image.",
        };
      }
      walletToSave.image = imageUploadRes.data;
    }

    if (!walletData.id) {
      walletToSave.amount = Number(walletData.amount ?? 0);
      walletToSave.totalIncome = Number(walletData.totalIncome ?? 0);
      walletToSave.totalExpenses = Number(walletData.totalExpenses ?? 0);
      walletToSave.created = new Date();
    }

    const walletRef = walletData?.id
      ? doc(firestore, "wallets", walletData?.id)
      : doc(collection(firestore, "wallets"));

    await setDoc(walletRef, walletToSave, { merge: true });
    return { success: true, data: { ...walletToSave, id: walletRef.id } };
  } catch (error: any) {
    return { success: false, msg: error?.message };
  }
};

export const deleteWallet = async (walletId: string): Promise<ResponseType> => {
  try {
    const walletRef = doc(firestore, "wallets", walletId);
    await deleteDoc(walletRef);
    deleteTransactionByWalletId(walletId);
    return { success: true, msg: "Wallet deleted successfully" };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const deleteTransactionByWalletId = async (
  walletId: string,
): Promise<ResponseType> => {
  try {
    let hasMoreTransaction = true;
    while (hasMoreTransaction) {
      const transactionQuery = query(
        collection(firestore, "transactions"),
        where("walletId", "==", walletId),
      );

      const transactionSnapshot = await getDocs(transactionQuery);
      if (transactionSnapshot.size === 0) {
        hasMoreTransaction = false;
      }

      const batch = writeBatch(firestore);

      transactionSnapshot.forEach((transactionDoc) => {
        batch.delete(transactionDoc.ref);
      });

      await batch.commit();
    }

    return { success: true, msg: "All transactions deleted successfully" };
  } catch (err: any) {
    return { success: false, msg: err.message };
  }
};

export const SYSTEM_WALLET_IDS = (uid: string) => ({
  payable: `__payable__${uid}`,
  receivable: `__receivable__${uid}`,
});

export const isSystemWalletId = (id?: string) =>
  !!id &&
  (id.startsWith("__payable__") || id.startsWith("__receivable__"));

export const isSystemWallet = (wallet: WalletType) => {
  const id = String((wallet as any)?.id ?? "");
  const name = String(wallet?.name ?? "").trim().toLowerCase();

  return (
    wallet?.hidden === true ||
    wallet?.isSystem === true ||
    isSystemWalletId(id) ||
    name === "payable" ||
    name === "receivable"
  );
};


export const ensureSystemWallets = async (uid: string) => {
  if (!uid) throw new Error("uid wajib");

  const ids = SYSTEM_WALLET_IDS(uid);

  const payableRef = doc(firestore, "wallets", ids.payable);
  const receivableRef = doc(firestore, "wallets", ids.receivable);

  await runTransaction(firestore, async (t) => {
    const pSnap = await t.get(payableRef);
    const rSnap = await t.get(receivableRef);

    if (!pSnap.exists()) {
      const data: WalletType = {
        uid,
        name: "Payable",
        amount: 0,
        image: null,
        hidden: true,
        isSystem: true,
      };
      t.set(payableRef, { ...data, created: serverTimestamp() });
    }

    if (!rSnap.exists()) {
      const data: WalletType = {
        uid,
        name: "Receivable",
        amount: 0,
        image: null,
        hidden: true,
        isSystem: true,
      };
      t.set(receivableRef, { ...data, created: serverTimestamp() });
    }
  });

  return ids;
};

/**
 * ✅ helper buat filter wallet yang tampil di UI (My Wallet / picker normal)
 */
export const filterVisibleWallets = (wallets: WalletType[]) =>
  wallets.filter((w) => !isSystemWallet(w));
