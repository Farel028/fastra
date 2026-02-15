import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import ModalWrapper from "@/components/ModalWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { expenseCategories } from "@/constants/data";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import useFetchData from "@/hooks/useFetchData";
import {
  createOrUpdateTransaction,
  deleteTransaction,
} from "@/services/transactionService";
import { TransactionType, WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { orderBy, where } from "firebase/firestore";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type ParamType = {
  id: string;
  type: string;
  amount: string;
  category?: string;
  date: string;
  description: string;
  image?: string;
  uid?: string;
  walletId: string;
};

const quickTypes = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Transfer", value: "transfer" },
];

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const clampOneLine = (t?: string) => (t ?? "").replace(/\s+/g, " ").trim();

const TransactionModal = () => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const oldTransaction: Partial<ParamType> = useMemo(
    () => ({
      id: first(params.id),
      type: first(params.type),
      amount: first(params.amount),
      category: first(params.category),
      date: first(params.date),
      description: first(params.description),
      image: first(params.image),
      walletId: first(params.walletId),
    }),
    [params],
  );

  const [transaction, setTransaction] = useState<TransactionType>({
    type: "expense",
    amount: 0,
    description: "",
    category: "",
    date: new Date(),
    walletId: "",
    image: null,
  });

  const [loading, setLoading] = useState(false);
  const [amountStr, setAmountStr] = useState("0");

  // transfer UI (sementara)
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");

  // modals
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletTarget, setWalletTarget] = useState<"main" | "from" | "to">(
    "main",
  );
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const { data: wallets, loading: walletLoading } = useFetchData<WalletType>(
    "wallets",
    [where("uid", "==", user?.uid), orderBy("created", "desc")],
  );

  const walletById = useMemo(() => {
    const map = new Map<string, WalletType>();
    wallets.forEach((w) => map.set(w.id as any, w));
    return map;
  }, [wallets]);

  const selectedWalletName = useMemo(() => {
    const w = walletById.get(transaction.walletId);
    return w ? w.name : "Wallet";
  }, [transaction.walletId, walletById]);

  const selectedFromName = useMemo(() => {
    const w = walletById.get(transferFromId);
    return w ? w.name : "From wallet";
  }, [transferFromId, walletById]);

  const selectedToName = useMemo(() => {
    const w = walletById.get(transferToId);
    return w ? w.name : "To wallet";
  }, [transferToId, walletById]);

  const setAmountFromStr = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "");
    const normalized = clean.length ? String(Number(clean)) : "0";
    setAmountStr(normalized);
    setTransaction((prev) => ({ ...prev, amount: Number(normalized) }));
  };

  useEffect(() => {
    if (oldTransaction?.id) {
      const amt = Number(oldTransaction.amount ?? 0);

      setTransaction({
        type: (oldTransaction.type as any) ?? "expense",
        amount: amt,
        description: oldTransaction.description ?? "",
        category: oldTransaction.category ?? "",
        date: oldTransaction.date ? new Date(oldTransaction.date) : new Date(),
        walletId: oldTransaction.walletId ?? "",
        image: oldTransaction.image ?? null,
      });

      setAmountStr(String(amt));
      setNoteDraft(oldTransaction.description ?? "");
    } else {
      setNoteDraft("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ auto-select "wallet utama" (wallet paling baru dari query)
  useEffect(() => {
    if (walletLoading) return;
    if (transaction.type === ("transfer" as any)) return;

    if (!transaction.walletId && wallets.length > 0) {
      setTransaction((p) => ({ ...p, walletId: wallets[0].id as any }));
    }
  }, [walletLoading, wallets, transaction.type, transaction.walletId]);

  const submitDisabled =
    loading ||
    Number(amountStr) <= 0 ||
    (transaction.type === "expense" && !transaction.category) ||
    (transaction.type === "income" && !transaction.walletId) ||
    (transaction.type === "expense" && !transaction.walletId) ||
    (transaction.type === ("transfer" as any) &&
      (!transferFromId || !transferToId));

  const onSubmit = async () => {
    if (submitDisabled) return;

    if (transaction.type === ("transfer" as any)) {
      Alert.alert("Transfer", "UI sudah. Logic transfer coming soon 😄");
      return;
    }

    const { type, amount, description, category, date, walletId, image } =
      transaction;

    if (!walletId || !date || !amount || (type == "expense" && !category)) {
      Alert.alert("Transaction", "Please fill all the field");
      return;
    }

    let transactionData: TransactionType = {
      type,
      amount,
      description,
      category,
      date,
      walletId,
      image: image ? image : null,
      uid: user?.uid,
    };

    if (oldTransaction?.id) transactionData.id = oldTransaction.id;

    setLoading(true);
    const res = await createOrUpdateTransaction(transactionData);
    setLoading(false);

    if (res.success) router.back();
    else Alert.alert("Transaction", res.msg);
  };

  const onDelete = async () => {
    if (!oldTransaction?.id) return;
    setLoading(true);
    const res = await deleteTransaction(
      oldTransaction?.id,
      oldTransaction.walletId ?? "",
    );
    setLoading(false);
    if (res.success) router.back();
    else Alert.alert("Transaction", res.msg);
  };

  const showDeleteAlert = () => {
    Alert.alert("Confirm", "Yakin?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", onPress: onDelete, style: "destructive" },
    ]);
  };

  const openWalletModal = (target: "main" | "from" | "to") => {
    setWalletTarget(target);
    setWalletModalVisible(true);
  };

  const pickWallet = (id: string) => {
    if (walletTarget === "main")
      setTransaction((p) => ({ ...p, walletId: id }));
    else if (walletTarget === "from") setTransferFromId(id);
    else setTransferToId(id);

    setWalletModalVisible(false);
  };

  const onDateChange = (event: any, selectedDate: any) => {
    if (Platform.OS === "android") {
      if (event?.type === "dismissed") {
        setDateModalVisible(false);
        return;
      }
      const d = selectedDate || transaction.date;
      setTransaction((p) => ({ ...p, date: d }));
      setDateModalVisible(false);
      return;
    }
    const d = selectedDate || transaction.date;
    setTransaction((p) => ({ ...p, date: d }));
  };

  const handleTypeChange = (value: string) => {
    setTransaction((p) => ({
      ...p,
      type: value as any,
      category: value === "expense" ? p.category : "",
      walletId: value === "transfer" ? "" : p.walletId,
    }));
  };

  // ✅ label tanggal untuk tombol date (di atas submit)
  const dateLabel = useMemo(() => {
    const d = transaction.date as Date;
    const day = d.toLocaleDateString("id-ID", { weekday: "short" });
    const date = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${day}, ${date}\n${time}`;
  }, [transaction.date]);

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={oldTransaction?.id ? "Update Transaction" : "New Transaction"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
          rightIcon={
            oldTransaction?.id ? (
              <TouchableOpacity
                onPress={showDeleteAlert}
                style={styles.headerAction}
                activeOpacity={0.85}
              >
                <Icons.Trash
                  size={verticalScale(20)}
                  color={colors.white}
                  weight="bold"
                />
              </TouchableOpacity>
            ) : undefined
          }
        />

        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.typeRow}>
            {quickTypes.map((t) => {
              const active = transaction.type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typePill, active && styles.typePillActive]}
                  onPress={() => handleTypeChange(t.value)}
                  activeOpacity={0.85}
                >
                  <Typo
                    fontWeight={"800"}
                    color={active ? colors.black : colors.white}
                  >
                    {t.label}
                  </Typo>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.cameraBtn}
              onPress={() => setReceiptModalVisible(true)}
            >
              <Icons.Camera
                size={verticalScale(20)}
                color={colors.white}
                weight="bold"
              />
            </TouchableOpacity>
          </View>

          {/* CATEGORY ICON ROW (expense only) */}
          {transaction.type === "expense" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {Object.values(expenseCategories).map((cat) => {
                const active = transaction.category === cat.value;
                const IconComp: any = cat.icon;

                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.catItem, active && styles.catItemActive]}
                    onPress={() =>
                      setTransaction((p) => ({ ...p, category: cat.value }))
                    }
                    activeOpacity={0.88}
                  >
                    <View
                      style={[
                        styles.catIconWrap,
                        {
                          backgroundColor: active ? cat.bgColor : colors.black,
                          borderColor: active ? cat.bgColor : colors.neutral700,
                        },
                      ]}
                    >
                      <IconComp
                        size={verticalScale(22)}
                        color={active ? colors.white : colors.neutral400}
                        weight={active ? "fill" : "regular"}
                      />
                    </View>

                    {/* ✅ label normal (nggak dipaksa wrapper) */}
                    <Typo
                      size={12}
                      color={colors.neutral200}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.catLabel}
                    >
                      {cat.label}
                    </Typo>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* TRANSFER UI (sementara) */}
          {transaction.type === ("transfer" as any) && (
            <View style={styles.transferBox}>
              <Typo color={colors.neutral200} size={14}>
                Transfer
              </Typo>

              <View style={styles.transferRow}>
                <Pressable
                  style={styles.pickerInput}
                  onPress={() => openWalletModal("from")}
                >
                  <Typo
                    style={styles.pickerText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedFromName}
                  </Typo>
                  <Icons.CaretDown
                    size={verticalScale(18)}
                    color={colors.neutral300}
                    weight="bold"
                  />
                </Pressable>

                <View style={styles.transferArrow}>
                  <Icons.ArrowRight
                    size={verticalScale(18)}
                    color={colors.neutral300}
                    weight="bold"
                  />
                </View>

                <Pressable
                  style={styles.pickerInput}
                  onPress={() => openWalletModal("to")}
                >
                  <Typo
                    style={styles.pickerText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedToName}
                  </Typo>
                  <Icons.CaretDown
                    size={verticalScale(18)}
                    color={colors.neutral300}
                    weight="bold"
                  />
                </Pressable>
              </View>

              <Typo size={12} color={colors.neutral500}>
                (Logic transfer belum dibuat — UI dulu)
              </Typo>
            </View>
          )}

          {/* AMOUNT BIG */}
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

          <View style={{ height: verticalScale(320) }} />
        </ScrollView>

        {/* ------------------ STICKY PANEL (NOTE/WALLET + NUMPAD) ------------------ */}
        <View style={styles.sticky}>
          <View style={styles.stickyTopRow}>
            {/* NOTE */}
            <Pressable
              style={[styles.pickerInput, styles.noteInputWrap]}
              onPress={() => setNoteModalVisible(true)}
            >
              <Icons.PencilSimpleLine
                size={verticalScale(18)}
                color={colors.neutral300}
                weight="bold"
              />
              <Typo
                style={{ flex: 1 }}
                color={
                  transaction.description?.trim()
                    ? colors.white
                    : colors.neutral400
                }
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {transaction.description?.trim()
                  ? clampOneLine(transaction.description)
                  : "Add note"}
              </Typo>
            </Pressable>

            {/* WALLET */}
            {transaction.type !== ("transfer" as any) && (
              <Pressable
                style={[styles.pickerInput, styles.walletInputWrap]}
                onPress={() => openWalletModal("main")}
              >
                <Icons.Wallet
                  size={verticalScale(18)}
                  color={colors.neutral300}
                  weight="bold"
                />
                <Typo
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ flex: 1 }}
                >
                  {selectedWalletName}
                </Typo>
                <Icons.CaretDown
                  size={verticalScale(18)}
                  color={colors.neutral300}
                  weight="bold"
                />
              </Pressable>
            )}
          </View>

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
            onOpenDate={() => setDateModalVisible(true)}
            onSubmit={onSubmit}
            submitDisabled={submitDisabled}
            dateLabel={dateLabel}
          />
        </View>
      </View>

      {/* WALLET SHEET */}
      <SheetModal
        visible={walletModalVisible}
        title="Select Wallet"
        onClose={() => setWalletModalVisible(false)}
      >
        <ScrollView style={{ maxHeight: verticalScale(360) }}>
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              activeOpacity={0.85}
              style={styles.walletRow}
              onPress={() => pickWallet(w.id as any)}
            >
              <View style={{ flex: 1 }}>
                <Typo fontWeight={"700"} numberOfLines={1} ellipsizeMode="tail">
                  {w.name}
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  {formatRupiah(w.amount)}
                </Typo>
              </View>

              <Icons.CaretRight
                size={verticalScale(18)}
                color={colors.neutral300}
                weight="bold"
              />
            </TouchableOpacity>
          ))}

          {!walletLoading && wallets.length === 0 && (
            <View style={{ paddingVertical: spacingY._15 }}>
              <Typo color={colors.neutral400}>
                No wallets found. Create one first.
              </Typo>
            </View>
          )}
        </ScrollView>
      </SheetModal>

      {/* NOTE SHEET */}
      <SheetModal
        visible={noteModalVisible}
        title="Add Note"
        onClose={() => setNoteModalVisible(false)}
      >
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
              setNoteDraft(transaction.description ?? "");
              setNoteModalVisible(false);
            }}
          >
            <Typo fontWeight={"800"}>Cancel</Typo>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setTransaction((p) => ({ ...p, description: noteDraft }));
              setNoteModalVisible(false);
            }}
          >
            <Typo fontWeight={"900"} color={colors.black}>
              Save
            </Typo>
          </TouchableOpacity>
        </View>
      </SheetModal>

      {/* RECEIPT SHEET */}
      <SheetModal
        visible={receiptModalVisible}
        title="Receipt"
        onClose={() => setReceiptModalVisible(false)}
      >
        <ImageUpload
          file={transaction.image}
          onClear={() => setTransaction((p) => ({ ...p, image: null }))}
          onSelect={(file) => setTransaction((p) => ({ ...p, image: file }))}
          placeholder="Upload Image"
        />
      </SheetModal>

      {/* DATE SHEET */}
      <SheetModal
        visible={dateModalVisible}
        title="Select Date"
        onClose={() => setDateModalVisible(false)}
      >
        <View style={{ paddingBottom: spacingY._10 }}>
          <DateTimePicker
            themeVariant="dark"
            value={transaction.date as Date}
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

export default TransactionModal;

/* ------------------------ Ollo Numpad ------------------------ */
const OlloNumpad = ({
  onKey,
  onBackspace,
  onClear,
  onSubmit,
  onOpenDate,
  submitDisabled,
  dateLabel,
}: {
  value: string;
  onKey: (k: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onOpenDate: () => void;
  submitDisabled: boolean;
  dateLabel: string; // "Sen, 15 Feb 2026\n12:33"
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
                <Typo size={18} fontWeight={"800"}>
                  {k}
                </Typo>
              </TouchableOpacity>
            ))}
          </View>

          {/* kanan: delete */}
          {idx === 0 && (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.padKey, styles.padDelete]}
              onPress={onBackspace}
              onLongPress={onClear}
              delayLongPress={350}
            >
              <Icons.Backspace
                size={verticalScale(18)}
                color={colors.rose}
                weight="bold"
              />
            </TouchableOpacity>
          )}

          {/* kanan: calculator */}
          {idx === 1 && (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.padKey, styles.padTool]}
              onPress={() => {}}
            >
              <Icons.Calculator
                size={verticalScale(18)}
                color={colors.white}
                weight="bold"
              />
            </TouchableOpacity>
          )}

          {/* kanan: date (di atas submit) */}
          {idx === 2 && (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.padKey, styles.padDateBtn]}
              onPress={onOpenDate}
            >
              <Typo size={11} color={colors.neutral300} numberOfLines={1}>
                {dateLabel.split("\n")[0]}
              </Typo>
              <Typo size={14} fontWeight={"800"} numberOfLines={1}>
                {dateLabel.split("\n")[1]}
              </Typo>
            </TouchableOpacity>
          )}

          {/* kanan: submit */}
          {idx === 3 && (
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.padKey,
                styles.padSubmit,
                submitDisabled && { opacity: 0.45 },
              ]}
              onPress={onSubmit}
              disabled={submitDisabled}
            >
              <Icons.Check
                size={verticalScale(22)}
                color={colors.black}
                weight="bold"
              />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

/* ------------------------ STYLES ------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  form: {
    gap: spacingY._20,
    paddingBottom: spacingY._40,
  },

  headerAction: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: verticalScale(40),
    borderWidth: 1,
    borderColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral900,
  },

  typeRow: { flexDirection: "row", gap: scale(10), alignItems: "center" },
  typePill: {
    flex: 1,
    height: verticalScale(46),
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.neutral700,
    justifyContent: "center",
    alignItems: "center",
  },
  typePillActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  cameraBtn: {
    width: verticalScale(46),
    height: verticalScale(46),
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.neutral700,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral900,
  },

  catRow: { gap: scale(14), paddingVertical: spacingY._5 },
  catItem: { alignItems: "center", gap: scale(6) },
  catItemActive: { transform: [{ scale: 1.02 }] },
  catIconWrap: {
    width: verticalScale(54),
    height: verticalScale(54),
    borderRadius: verticalScale(54),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  // ✅ label normal
  catLabel: {
    width: verticalScale(76),
    textAlign: "center",
  },

  amountCard: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._10,
  },
  amountHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currencyBadge: {
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._7,
    borderRadius: radius._12,
    backgroundColor: colors.neutral700,
  },

  transferBox: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._10,
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  transferArrow: {
    width: verticalScale(34),
    height: verticalScale(34),
    borderRadius: verticalScale(34),
    borderWidth: 1,
    borderColor: colors.neutral700,
    justifyContent: "center",
    alignItems: "center",
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
  pickerText: {
    flex: 1,
    paddingRight: scale(6),
  },

  sticky: {
    position: "absolute",
    left: spacingY._20,
    right: spacingY._20,
    bottom: spacingY._15,
    gap: spacingY._12,
  },
  stickyTopRow: {
    flexDirection: "row",
    gap: scale(10),
    alignItems: "center",
  },

  noteInputWrap: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacingX._12,
    gap: scale(8),
  },

  walletInputWrap: {
    width: scale(150),
    paddingHorizontal: spacingX._12,
    gap: scale(8),
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

  padWrap: {
    gap: scale(10),
  },
  padRow: {
    flexDirection: "row",
    gap: scale(10),
  },
  padCols: {
    flex: 1,
    flexDirection: "row",
    gap: scale(10),
  },
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
  padTool: {
    flex: 0,
    width: "24%",
  },
  padDateBtn: {
    flex: 0,
    width: "24%",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacingX._12,
    gap: scale(2),
  },
  padSubmit: {
    flex: 0,
    width: "24%",
    backgroundColor: colors.neutral200,
    borderColor: colors.neutral200,
  },
});
