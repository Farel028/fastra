import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { deleteDebt } from "@/services/debtService";
import { WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { documentId, orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

type DebtKind = "HUTANG" | "PIUTANG";
type DebtStatus = "ONGOING" | "PAID";

type DebtDoc = {
  id?: string;
  uid: string;
  kind: DebtKind;
  personName: string;
  title?: string;
  note?: string;
  amount: number;
  paidAmount: number;
  status?: DebtStatus;
  walletId: string;
  dueDate?: any;
  created?: any;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export default function DebtDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [focusRefreshKey, setFocusRefreshKey] = useState(0);

  const id = first(params.id) ?? "";

  useFocusEffect(
    useCallback(() => {
      setFocusRefreshKey((prev) => prev + 1);
    }, []),
  );

  const fallbackKind = (first(params.kind) ?? "HUTANG") as DebtKind;
  const fallbackPersonName = first(params.personName) ?? "Someone";
  const fallbackTitle = first(params.title) ?? "";
  const fallbackNote = first(params.note) ?? "";
  const fallbackAmount = Number(first(params.amount) ?? 0);
  const fallbackPaidAmount = Number(first(params.paidAmount) ?? 0);
  const fallbackWalletId = first(params.walletId) ?? "";
  const dueISO = first(params.dueDate);
  const createdISO = first(params.created);

  const debtConstraints = useMemo(
    () => (id ? [where(documentId(), "==", id)] : []),
    [id],
  );

  const { data: debtRaw, loading: debtLoading } = useFetchData<DebtDoc>(
    user?.uid && id ? "debts" : "",
    debtConstraints,
    focusRefreshKey,
  );

  const debt = useMemo(() => {
    const row = debtRaw?.[0];
    if (!row) return undefined;
    if (user?.uid && row.uid && row.uid !== user.uid) return undefined;
    return row;
  }, [debtRaw, user?.uid]);

  const walletConstraints = useMemo(
    () => (user?.uid ? [where("uid", "==", user.uid), orderBy("created", "desc")] : []),
    [user?.uid],
  );

  const { data: walletsRaw } = useFetchData<WalletType>(
    user?.uid ? "wallets" : "",
    walletConstraints,
    focusRefreshKey,
  );

  const wallets = useMemo(() => (walletsRaw ?? []).filter((w) => !w.hidden && !w.isSystem), [walletsRaw]);

  const kind = (debt?.kind ?? fallbackKind) as DebtKind;
  const personName = debt?.personName ?? fallbackPersonName;
  const title = debt?.title ?? fallbackTitle;
  const note = debt?.note ?? fallbackNote;
  const amount = Number(debt?.amount ?? fallbackAmount);
  const paidAmount = Number(debt?.paidAmount ?? fallbackPaidAmount);
  const walletId = String(debt?.walletId ?? fallbackWalletId);
  const remaining = Math.max(0, amount - paidAmount);
  const isPiutang = kind === "PIUTANG";

  const dueObj = useMemo(() => toDate(debt?.dueDate) ?? toDate(dueISO), [debt?.dueDate, dueISO]);
  const createdObj = useMemo(
    () => toDate(debt?.created) ?? toDate(createdISO),
    [createdISO, debt?.created],
  );

  const walletText = useMemo(() => {
    const w = wallets.find((x) => String(x.id) === walletId);
    return w?.name ?? "Wallet";
  }, [walletId, wallets]);

  const dueText = dueObj
    ? dueObj.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    : "-";

  const createdText = createdObj
    ? createdObj.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";

  const statusText =
    remaining <= 0 || debt?.status === "PAID"
      ? "Paid"
      : dueObj && dueObj.getTime() < Date.now()
        ? "Overdue"
        : "Ongoing";

  const statusColor =
    statusText === "Paid"
      ? colors.primary
      : statusText === "Overdue"
        ? colors.rose
        : colors.neutral400;

  const heroLabel = isPiutang ? "Piutang" : "Hutang";
  const amountColor = isPiutang ? colors.primary : colors.rose;

  const onEdit = () => {
    router.push({
      pathname: "/(modals)/debtModal",
      params: {
        id,
        kind,
        personName,
        title,
        note,
        amount: String(amount),
        paidAmount: String(paidAmount),
        walletId,
        date: createdObj ? createdObj.toISOString() : "",
        dueDate: dueObj ? dueObj.toISOString() : "",
      },
    });
  };

  const onAddPayment = () => {
    router.push({
      pathname: "/(modals)/debtPaymentModal",
      params: {
        debtId: id,
        kind,
        personName,
        remaining: String(remaining),
      },
    });
  };

  const onDelete = async () => {
    if (!id) {
      Alert.alert("Error", "Debt id tidak ditemukan.");
      return;
    }

    setLoading(true);
    const res = await deleteDebt({ debtId: id, uid: user?.uid });
    setLoading(false);

    if (res?.success) router.back();
    else Alert.alert("Delete", res?.msg ?? "Gagal hapus debt");
  };

  const confirmDelete = () => {
    if (loading) return;
    Alert.alert("Hapus debt?", "Aksi ini tidak bisa dibatalkan.", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title="Debt Detail" leftIcon={<BackButton />} style={{ paddingTop: scale(10) }} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: isPiutang ? "#10221A" : "#2A1012" }]}>
              {isPiutang ? (
                <Icons.HandCoins size={verticalScale(36)} color={colors.primary} weight="bold" />
              ) : (
                <Icons.Receipt size={verticalScale(36)} color={colors.rose} weight="bold" />
              )}
            </View>

            <Typo size={34} fontWeight={"900"} color={amountColor} style={{ marginTop: spacingY._10 }}>
              {formatRupiah(remaining)}
            </Typo>

            <Typo size={14} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
              Sisa {heroLabel}
            </Typo>

            <View style={{ marginTop: spacingY._10 }}>
              <Typo size={13} color={statusColor} fontWeight={"700"}>
                {statusText}
              </Typo>
            </View>
          </View>

          <View style={styles.card}>
            <Row label="Person" value={personName} />
            <Divider />

            <Row label="Type" value={heroLabel} />
            <Divider />

            {!!title?.trim() && (
              <>
                <Row label="Title" value={title} />
                <Divider />
              </>
            )}

            <Row label="Total" value={formatRupiah(amount)} />
            <Divider />

            <Row label="Paid" value={formatRupiah(paidAmount)} />
            <Divider />

            <Row label="Remaining" value={formatRupiah(remaining)} />
            <Divider />

            <Row label="Initial Wallet" value={walletText} />
            <Divider />

            <Row label="Due Date" value={dueText} />
            <Divider />

            <Row label="Created" value={createdText} />

            {!!note?.trim() && (
              <>
                <Divider />
                <Row label="Note" value={note} />
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomTabs}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.btn, styles.btnDanger, (loading || debtLoading) && { opacity: 0.5 }]}
            onPress={confirmDelete}
            disabled={loading || debtLoading}
          >
            <Icons.Trash size={verticalScale(20)} color={colors.rose} weight="bold" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.btn, styles.btnPrimary, (loading || debtLoading) && { opacity: 0.5 }]}
            onPress={onAddPayment}
            disabled={loading || debtLoading || remaining <= 0}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: scale(10) }}>
              <Icons.PlusCircle size={verticalScale(20)} color={colors.black} weight="bold" />
              <Typo fontWeight={"900"} color={colors.black}>
                Add Payment
              </Typo>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.btn, styles.btnEdit, (loading || debtLoading) && { opacity: 0.5 }]}
            onPress={onEdit}
            disabled={loading || debtLoading || !id}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: scale(10) }}>
              <Icons.PencilSimpleLine size={verticalScale(20)} color={colors.neutral200} weight="bold" />
              <Typo fontWeight={"900"} color={colors.neutral200}>
                Edit
              </Typo>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Typo size={14} color={colors.neutral400}>
        {label}
      </Typo>
      <Typo size={16} fontWeight={"700"} style={{ maxWidth: "65%", textAlign: "right" }}>
        {value}
      </Typo>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },

  hero: {
    alignItems: "center",
    paddingTop: spacingY._20,
    paddingBottom: spacingY._10,
  },
  heroIcon: {
    width: verticalScale(90),
    height: verticalScale(90),
    borderRadius: verticalScale(90),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral800,
  },

  card: {
    marginTop: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._12,
    backgroundColor: colors.neutral900,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacingX._12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral800,
  },

  bottomTabs: {
    position: "absolute",
    left: spacingY._20,
    right: spacingY._20,
    bottom: spacingY._15,
    flexDirection: "row",
    gap: scale(12),
  },
  btn: {
    height: verticalScale(58),
    borderRadius: radius._17,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.neutral800,
    backgroundColor: colors.neutral900,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacingX._15,
  },
  btnDanger: {
    width: verticalScale(70),
    backgroundColor: "#2A1012",
    borderColor: "#3A1518",
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.neutral200,
    borderColor: colors.neutral200,
  },
  btnEdit: {
    flex: 1,
    backgroundColor: colors.neutral900,
    borderColor: colors.neutral800,
  },
});
