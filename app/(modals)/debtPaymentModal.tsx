import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ModalWrapper from "@/components/ModalWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import { addDebtPayment } from "@/services/debtService";
import { ensureSystemWallets } from "@/services/walletService";
import { WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type DebtKind = "PIUTANG" | "HUTANG";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const clampOneLine = (t?: string) => (t ?? "").replace(/\s+/g, " ").trim();

const DebtPaymentModal = () => {
  const { user } = useAuth();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        router.back();
        return true;
      });
      return () => sub.remove();
    }, [router]),
  );

  const params = useLocalSearchParams();
  const debtId = first(params.debtId) ?? "";
  const kind = (first(params.kind) ?? "HUTANG") as DebtKind;
  const personName = first(params.personName) ?? "";
  const remaining = Number(first(params.remaining) ?? 0);

  const [loading, setLoading] = useState(false);
  const [amountStr, setAmountStr] = useState("0");
  const amount = Number(amountStr) || 0;

  const [walletId, setWalletId] = useState("");
  const [walletModalVisible, setWalletModalVisible] = useState(false);

  const [date, setDate] = useState<Date>(new Date());
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const [note, setNote] = useState("");
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const walletConstraints = useMemo(
    () => (user?.uid ? [where("uid", "==", user.uid), orderBy("created", "desc")] : []),
    [user?.uid],
  );

  const { data: walletsRaw, loading: walletLoading } = useFetchData<WalletType>(
    user?.uid ? "wallets" : "",
    walletConstraints,
  );

  const wallets = useMemo(
    () => (walletsRaw ?? []).filter((w) => !w.hidden && !w.isSystem),
    [walletsRaw],
  );

  useEffect(() => {
    if (walletLoading) return;
    if (!walletId && wallets.length > 0) setWalletId(wallets.slice(-1)[0].id as any);
  }, [walletLoading, wallets, walletId]);

  const walletName = useMemo(() => {
    const w = wallets.find((x) => (x.id as any) === walletId);
    return w?.name ?? "Wallet";
  }, [wallets, walletId]);

  const setAmountFromStr = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "");
    const normalized = clean.length ? String(Number(clean)) : "0";
    setAmountStr(normalized);
  };

  const submitDisabled =
    loading ||
    !user?.uid ||
    !debtId ||
    !walletId ||
    amount <= 0 ||
    (remaining > 0 && amount > remaining);

  const titleText = kind === "PIUTANG" ? "Receive Payment" : "Pay Debt";
  const walletLabel = kind === "PIUTANG" ? "Receive to Wallet" : "Pay from Wallet";

  const dateLabel = useMemo(() => {
    const day = date.toLocaleDateString("id-ID", { weekday: "short" });
    const d = date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const t = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    return `${day}, ${d}\n${t}`;
  }, [date]);

  const onDateChange = (event: any, selectedDate: any) => {
    if (Platform.OS === "android") {
      if (event?.type === "dismissed") {
        setDateModalVisible(false);
        return;
      }
      const d = selectedDate || date;
      setDate(d);
      setDateModalVisible(false);
      return;
    }
    const d = selectedDate || date;
    setDate(d);
  };

  const anySheetOpen = walletModalVisible || dateModalVisible || noteModalVisible;

  const onSubmit = async () => {
    if (submitDisabled) return;

    setLoading(true);
    await ensureSystemWallets(user!.uid as string);

    const res = await addDebtPayment({
      uid: user!.uid as string,
      debtId,
      amount,
      walletId,
      date,
      note,
    });

    setLoading(false);

    if (res.success) router.back();
    else Alert.alert("Payment", res.msg);
  };

  return (
    <ModalWrapper onClose={() => router.back()} swipeEnabled={!anySheetOpen}>
      <View style={styles.container}>
        <Header title={titleText} leftIcon={<BackButton />} style={{ marginBottom: spacingY._10 }} />

        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          {/* Info */}
          <View style={styles.infoBox}>
            <Typo color={colors.neutral400} size={12}>
              Person
            </Typo>
            <Typo fontWeight={"900"} size={18}>
              {personName || "-"}
            </Typo>

            <View style={{ height: spacingY._10 }} />

            <Typo color={colors.neutral400} size={12}>
              Remaining
            </Typo>
            <Typo fontWeight={"900"} size={18} color={kind === "PIUTANG" ? colors.primary : colors.rose}>
              {formatRupiah(remaining)}
            </Typo>
          </View>

          {/* Amount */}
          <View style={styles.amountCard}>
            <View style={styles.amountHeader}>
              <View style={styles.currencyBadge}>
                <Typo fontWeight={"900"}>Rp</Typo>
              </View>
              <Typo color={colors.neutral400} size={14}>
                Amount
              </Typo>
            </View>

            <Typo size={36} fontWeight={"900"}>
              {formatRupiah(Number(amountStr))}
            </Typo>
          </View>

          {/* Wallet */}
          <Pressable style={styles.pickerInput} onPress={() => setWalletModalVisible(true)}>
            <Icons.Wallet size={verticalScale(18)} color={colors.neutral300} weight="bold" />
            <Typo numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
              {walletLabel}: {walletName}
            </Typo>
            <Icons.CaretDown size={verticalScale(18)} color={colors.neutral300} weight="bold" />
          </Pressable>

          {/* Date */}
          <Pressable style={styles.pickerInput} onPress={() => setDateModalVisible(true)}>
            <Icons.Calendar size={verticalScale(18)} color={colors.neutral300} weight="bold" />
            <Typo style={{ flex: 1 }} numberOfLines={2}>
              {dateLabel}
            </Typo>
          </Pressable>

          {/* Note */}
          <Pressable
            style={styles.pickerInput}
            onPress={() => {
              setNoteDraft(note);
              setNoteModalVisible(true);
            }}
          >
            <Icons.PencilSimpleLine size={verticalScale(18)} color={colors.neutral300} weight="bold" />
            <Typo
              style={{ flex: 1 }}
              color={note?.trim() ? colors.white : colors.neutral400}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {note?.trim() ? clampOneLine(note) : "Add note"}
            </Typo>
          </Pressable>

          {remaining > 0 && amount > remaining && (
            <Typo color={colors.rose} size={12}>
              Amount melebihi remaining.
            </Typo>
          )}

          <View style={{ height: verticalScale(260) }} />
        </ScrollView>

        <View style={styles.sticky}>
          <OlloNumpad
            value={amountStr}
            onKey={(k) => {
              if (amountStr === "0") setAmountFromStr(k === "000" ? "0" : k);
              else setAmountFromStr(amountStr + k);
            }}
            onBackspace={() => {
              const next = amountStr.length <= 1 ? "0" : amountStr.slice(0, -1);
              setAmountFromStr(next);
            }}
            onClear={() => setAmountFromStr("0")}
            onSubmit={onSubmit}
            submitDisabled={submitDisabled}
            submitLabel="Save"
          />
        </View>
      </View>

      {/* Wallet sheet */}
      <SheetModal visible={walletModalVisible} title="Select Wallet" onClose={() => setWalletModalVisible(false)}>
        <ScrollView style={{ maxHeight: verticalScale(360) }}>
          {wallets.map((w) => (
            <TouchableOpacity
              key={String(w.id)}
              activeOpacity={0.85}
              style={styles.walletRow}
              onPress={() => {
                setWalletId(w.id as any);
                setWalletModalVisible(false);
              }}
            >
              <View style={{ flex: 1 }}>
                <Typo fontWeight={"700"} numberOfLines={1} ellipsizeMode="tail">
                  {w.name}
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  {formatRupiah(w.amount)}
                </Typo>
              </View>

              <Icons.CaretRight size={verticalScale(18)} color={colors.neutral300} weight="bold" />
            </TouchableOpacity>
          ))}

          {!walletLoading && wallets.length === 0 && (
            <View style={{ paddingVertical: spacingY._15 }}>
              <Typo color={colors.neutral400}>No wallets found. Create one first.</Typo>
            </View>
          )}
        </ScrollView>
      </SheetModal>

      {/* Note sheet */}
      <SheetModal visible={noteModalVisible} title="Add Note" onClose={() => setNoteModalVisible(false)}>
        <View style={styles.noteBox}>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder="Type your note..."
            placeholderTextColor={colors.neutral500}
            multiline
            style={styles.noteInput}
          />
        </View>

        <View style={{ flexDirection: "row", gap: scale(10) }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.neutral700 }]}
            onPress={() => {
              setNoteDraft(note);
              setNoteModalVisible(false);
            }}
          >
            <Typo fontWeight={"800"}>Cancel</Typo>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setNote(noteDraft);
              setNoteModalVisible(false);
            }}
          >
            <Typo fontWeight={"900"} color={colors.black}>
              Save
            </Typo>
          </TouchableOpacity>
        </View>
      </SheetModal>

      {/* Date sheet */}
      <SheetModal visible={dateModalVisible} title="Select Date" onClose={() => setDateModalVisible(false)}>
        <View style={{ paddingBottom: spacingY._10 }}>
          <DateTimePicker
            themeVariant="dark"
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
          />
        </View>

        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setDateModalVisible(false)}
          >
            <Typo fontWeight={"900"} color={colors.black}>
              OK
            </Typo>
          </TouchableOpacity>
        )}
      </SheetModal>
    </ModalWrapper>
  );
};

export default DebtPaymentModal;

/* ------------------------ Ollo Numpad ------------------------ */
const OlloNumpad = ({
  onKey,
  onBackspace,
  onClear,
  onSubmit,
  submitDisabled,
  submitLabel,
}: {
  value: string;
  onKey: (k: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitLabel: string;
}) => {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["C", "0", "000"],
  ] as const;

  return (
    <View style={styles.padWrap}>
      {rows.map((r, idx) => (
        <View key={idx} style={styles.padRow}>
          <View style={styles.padCols}>
            {r.map((k) => (
              <TouchableOpacity
                key={k}
                activeOpacity={0.88}
                style={styles.padKey}
                onPress={() => {
                  if (k === "C") onClear();
                  else onKey(k);
                }}
              >
                <Typo size={18} fontWeight={"800"}>{k}</Typo>
              </TouchableOpacity>
            ))}
          </View>

          {idx === 0 && (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.padKey, styles.padDelete]}
              onPress={onBackspace}
              onLongPress={onClear}
              delayLongPress={350}
            >
              <Icons.Backspace size={verticalScale(18)} color={colors.rose} weight="bold" />
            </TouchableOpacity>
          )}

          {idx === 1 && <View style={[styles.padKey, styles.padTool]} />}
          {idx === 2 && <View style={[styles.padKey, styles.padTool]} />}

          {idx === 3 && (
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.padKey, styles.padSubmit, submitDisabled && { opacity: 0.45 }]}
              onPress={onSubmit}
              disabled={submitDisabled}
            >
              <View style={{ alignItems: "center" }}>
                <Icons.Check size={verticalScale(22)} color={colors.black} weight="bold" />
                <Typo size={11} fontWeight={"900"} color={colors.black}>
                  {submitLabel}
                </Typo>
              </View>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

/* ------------------------ STYLES ------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacingY._20 },
  form: { gap: spacingY._15, paddingBottom: spacingY._40 },

  infoBox: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    padding: spacingY._15,
    backgroundColor: colors.neutral900,
  },

  amountCard: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._10,
    backgroundColor: colors.neutral900,
  },
  amountHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  currencyBadge: {
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._7,
    borderRadius: radius._12,
    backgroundColor: colors.neutral700,
  },

  pickerInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(10),
    height: verticalScale(54),
    paddingHorizontal: spacingX._15,
    borderRadius: radius._15,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral900,
  },

  sticky: {
    position: "absolute",
    left: spacingY._20,
    right: spacingY._20,
    bottom: spacingY._15,
    gap: spacingY._12,
    backgroundColor: colors.neutral900,
  },

  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    paddingVertical: spacingY._12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral800,
  },

  noteBox: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    padding: spacingY._12,
    minHeight: verticalScale(120),
  },
  noteInput: {
    color: colors.white,
    fontSize: verticalScale(14),
    minHeight: verticalScale(100),
    textAlignVertical: "top",
  },
  actionBtn: {
    flex: 1,
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
  },

  padWrap: { gap: scale(10) },
  padRow: { flexDirection: "row", gap: scale(10) },
  padCols: { flex: 1, flexDirection: "row", gap: scale(10) },
  padKey: {
    flex: 1,
    height: verticalScale(62),
    borderRadius: radius._17,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.neutral800,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral900,
  },
  padDelete: {
    flex: 0,
    width: "24%",
    backgroundColor: "#2A1012",
    borderColor: "#3A1518",
  },
  padTool: { flex: 0, width: "24%" },
  padSubmit: {
    flex: 0,
    width: "24%",
    backgroundColor: colors.neutral200,
    borderColor: colors.neutral200,
  },
});
