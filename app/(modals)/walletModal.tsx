import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { createOrUpdateWallet, deleteWallet } from "@/services/walletService";
import { WalletType } from "@/types";
import { formatRupiah } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const decodeParam = (value: string | string[] | undefined) => {
  const raw = first(value);
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

type QuickIconCategory = "bank" | "ewallet" | "investasi" | "fintech";

type QuickIconPreset = {
  id: string;
  label: string;
  domain: string;
  category: QuickIconCategory;
};

const LOGO_DEV_PUBLIC_KEY = "pk_F2FvW5A7T-O4VDTvIMGxLQ";

const QUICK_ICON_PRESETS: QuickIconPreset[] = [
  { id: "bca", label: "BCA", domain: "bca.co.id", category: "bank" },
  { id: "bri", label: "BRI", domain: "bri.co.id", category: "bank" },
  {
    id: "mandiri",
    label: "Mandiri",
    domain: "bankmandiri.co.id",
    category: "bank",
  },
  { id: "bni", label: "BNI", domain: "bni.co.id", category: "bank" },
  { id: "btn", label: "BTN", domain: "btn.co.id", category: "bank" },
  { id: "bsi", label: "BSI", domain: "bankbsi.co.id", category: "bank" },
  {
    id: "cimb",
    label: "CIMB Niaga",
    domain: "cimbniaga.co.id",
    category: "bank",
  },
  {
    id: "danamon",
    label: "Danamon",
    domain: "danamon.co.id",
    category: "bank",
  },
  {
    id: "permata",
    label: "PermataBank",
    domain: "permatabank.com",
    category: "bank",
  },
  {
    id: "maybank",
    label: "Maybank",
    domain: "maybank.co.id",
    category: "bank",
  },
  { id: "ocbc", label: "OCBC", domain: "ocbc.id", category: "bank" },
  { id: "uob", label: "UOB", domain: "uob.co.id", category: "bank" },
  { id: "hsbc", label: "HSBC", domain: "hsbc.co.id", category: "bank" },
  { id: "dbs", label: "DBS", domain: "dbs.id", category: "bank" },
  { id: "panin", label: "Panin", domain: "panin.co.id", category: "bank" },
  { id: "mega", label: "Bank Mega", domain: "bankmega.com", category: "bank" },
  {
    id: "muamalat",
    label: "Muamalat",
    domain: "bankmuamalat.co.id",
    category: "bank",
  },
  { id: "jago", label: "Bank Jago", domain: "jago.com", category: "bank" },
  { id: "jenius", label: "Jenius", domain: "jenius.com", category: "bank" },
  {
    id: "seabank",
    label: "SeaBank",
    domain: "seabank.co.id",
    category: "bank",
  },
  { id: "neo", label: "Bank Neo", domain: "neobank.id", category: "bank" },
  {
    id: "allobank",
    label: "Allo Bank",
    domain: "allobank.com",
    category: "bank",
  },
  { id: "blu", label: "blu", domain: "bcadigital.co.id", category: "bank" },
  {
    id: "linebank",
    label: "LINE Bank",
    domain: "linebank.co.id",
    category: "bank",
  },
  { id: "gopay", label: "GoPay", domain: "gopay.co.id", category: "ewallet" },
  { id: "ovo", label: "OVO", domain: "ovo.id", category: "ewallet" },
  { id: "dana", label: "DANA", domain: "dana.id", category: "ewallet" },
  {
    id: "shopeepay",
    label: "ShopeePay",
    domain: "shopee.co.id",
    category: "ewallet",
  },
  {
    id: "linkaja",
    label: "LinkAja",
    domain: "linkaja.id",
    category: "ewallet",
  },
  { id: "isaku", label: "i.saku", domain: "isaku.co.id", category: "ewallet" },
  {
    id: "astrapay",
    label: "AstraPay",
    domain: "astrapay.com",
    category: "ewallet",
  },
  { id: "doku", label: "DOKU", domain: "doku.com", category: "ewallet" },
  { id: "sakuku", label: "Sakuku", domain: "sakuku.com", category: "ewallet" },
  { id: "bibit", label: "Bibit", domain: "bibit.id", category: "investasi" },
  {
    id: "ajaib",
    label: "Ajaib",
    domain: "ajaib.co.id",
    category: "investasi",
  },
  {
    id: "bareksa",
    label: "Bareksa",
    domain: "bareksa.com",
    category: "investasi",
  },
  {
    id: "pluang",
    label: "Pluang",
    domain: "pluang.com",
    category: "investasi",
  },
  {
    id: "stockbit",
    label: "Stockbit",
    domain: "stockbit.com",
    category: "investasi",
  },
  { id: "ipot", label: "IPOT", domain: "ipot.id", category: "investasi" },
  { id: "most", label: "MOST", domain: "most.co.id", category: "investasi" },
  {
    id: "nanovest",
    label: "Nanovest",
    domain: "nanovest.io",
    category: "investasi",
  },
  { id: "pintu", label: "Pintu", domain: "pintu.co.id", category: "investasi" },
  {
    id: "indodax",
    label: "Indodax",
    domain: "indodax.com",
    category: "investasi",
  },
  {
    id: "tokocrypto",
    label: "Tokocrypto",
    domain: "tokocrypto.com",
    category: "investasi",
  },
  { id: "reku", label: "Reku", domain: "reku.id", category: "investasi" },
  {
    id: "kredivo",
    label: "Kredivo",
    domain: "kredivo.com",
    category: "fintech",
  },
  {
    id: "akulaku",
    label: "Akulaku",
    domain: "akulaku.com",
    category: "fintech",
  },
  {
    id: "indodana",
    label: "Indodana",
    domain: "indodana.id",
    category: "fintech",
  },
  {
    id: "homecredit",
    label: "Home Credit",
    domain: "homecredit.co.id",
    category: "fintech",
  },
  { id: "atome", label: "Atome", domain: "atome.id", category: "fintech" },
];

const getLogoDevUrl = (domain: string) =>
  `https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=128&format=png`;

const QUICK_ICON_CATEGORY_LABELS: Record<QuickIconCategory, string> = {
  bank: "Bank",
  ewallet: "E-Wallet",
  investasi: "Investasi & Crypto",
  fintech: "Fintech / Paylater",
};

const QUICK_ICON_CATEGORY_ORDER: QuickIconCategory[] = [
  "bank",
  "ewallet",
  "investasi",
  "fintech",
];

const QUICK_ICON_OPTIONS = QUICK_ICON_PRESETS.map((preset) => ({
  ...preset,
  image: getLogoDevUrl(preset.domain),
}));

const QUICK_ICON_GROUPS = QUICK_ICON_CATEGORY_ORDER.map((category) => ({
  category,
  title: QUICK_ICON_CATEGORY_LABELS[category],
  options: QUICK_ICON_OPTIONS.filter((option) => option.category === category),
})).filter((group) => group.options.length > 0);

type WalletForm = {
  name: string;
  image: any;
  amount: number;
};

const WalletModal = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletForm>({
    name: "",
    image: null,
    amount: 0,
  });
  const [amountStr, setAmountStr] = useState("0");
  const [loading, setLoading] = useState(false);
  const [quickIconModalVisible, setQuickIconModalVisible] = useState(false);
  const router = useRouter();

  const params = useLocalSearchParams();
  const oldWallet = {
    id: first(params.id),
    name: first(params.name),
    image: decodeParam(params.image),
    amount: Number(first(params.amount) ?? 0),
  };

  useEffect(() => {
    if (oldWallet?.id) {
      setWallet({
        name: oldWallet?.name ?? "",
        image: oldWallet?.image ?? null,
        amount: Number(oldWallet?.amount ?? 0),
      });
      setAmountStr(String(Number(oldWallet?.amount ?? 0)));
    }
  }, [oldWallet?.amount, oldWallet?.id, oldWallet?.image, oldWallet?.name]);

  const setAmountFromStr = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "");
    const normalized = clean.length ? String(Number(clean)) : "0";
    setAmountStr(normalized);
    setWallet((prev) => ({ ...prev, amount: Number(normalized) }));
  };

  const onSubmit = async () => {
    let { name, image, amount } = wallet;
    if (!name.trim() || !image) {
      Alert.alert("Wallet", "Please fill all the fields");
      return;
    }
    if (amount < 0) {
      Alert.alert("Wallet", "Balance cannot be negative");
      return;
    }

    const data: WalletType = {
      name,
      image,
      amount: Number(amount),
      uid: user?.uid,
    };
    if (oldWallet?.id) data.id = oldWallet?.id;
    setLoading(true);
    const res = await createOrUpdateWallet(data);
    setLoading(false);

    if (res.success) {
      router.back();
    } else {
      Alert.alert("Wallet", res.msg);
    }
  };

  const selectedQuickIcon = QUICK_ICON_OPTIONS.find(
    (option) => option.image === wallet.image,
  );

  const onSelectQuickIcon = (option: (typeof QUICK_ICON_OPTIONS)[number]) => {
    setWallet((prev) => ({
      ...prev,
      image: option.image,
      name: prev.name.trim() ? prev.name : option.label,
    }));
    setQuickIconModalVisible(false);
  };

  const onDelete = async () => {
    if (!oldWallet?.id) return;
    setLoading(true);
    const res = await deleteWallet(oldWallet?.id);
    setLoading(false);
    if (res.success) {
      router.back();
    } else {
      Alert.alert("Wallet", res.msg);
    }
  };
  const showDeleteAlert = () => {
    Alert.alert("Confirm", "Yakin?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        onPress: onDelete,
        style: "destructive",
      },
    ]);
  };

  return (
    <ModalWrapper
      onClose={() => router.back()}
      swipeEnabled={!quickIconModalVisible}
    >
      <View style={styles.container}>
        <Header
          title={oldWallet?.id ? "Update Wallet" : "New Wallet"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Wallet Name</Typo>
            <Input
              placeholder="Salary"
              value={wallet.name}
              onChangeText={(value) => setWallet({ ...wallet, name: value })}
            />
          </View>
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Current Balance</Typo>
            <Input
              placeholder="0"
              value={amountStr}
              keyboardType="numeric"
              onChangeText={setAmountFromStr}
            />
            <Typo size={13} color={colors.neutral400}>
              {formatRupiah(Number(amountStr))}
            </Typo>
          </View>
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>
              Quick Icon
            </Typo>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.quickIconPicker}
              onPress={() => setQuickIconModalVisible(true)}
            >
              <View style={styles.quickIconPickerLeft}>
                {selectedQuickIcon ? (
                  <View style={styles.quickIconPreview}>
                    <Image
                      style={styles.quickIconImage}
                      source={selectedQuickIcon.image}
                      contentFit="contain"
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.quickIconPreview,
                      { alignItems: "center", justifyContent: "center" },
                    ]}
                  >
                    <Typo size={10} color={colors.neutral400}>
                      Icon
                    </Typo>
                  </View>
                )}

                <View style={styles.quickIconTextBlock}>
                  <Typo
                    fontWeight={"700"}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedQuickIcon?.label ?? "Pick an icon"}
                  </Typo>
                  <Typo
                    size={12}
                    color={colors.neutral400}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedQuickIcon?.domain ??
                      "bank, e-wallet, investment, fintech"}
                  </Typo>
                </View>
              </View>

              <Icons.CaretDownIcon
                size={verticalScale(18)}
                color={colors.neutral300}
                weight="bold"
              />
            </TouchableOpacity>
          </View>
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Wallet Icon</Typo>
            <ImageUpload
              file={wallet.image}
              onClear={() => setWallet({ ...wallet, image: null })}
              onSelect={(file) => setWallet({ ...wallet, image: file })}
              placeholder="Upload Image"
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {oldWallet?.id && !loading && (
          <Button
            onPress={showDeleteAlert}
            style={{
              backgroundColor: colors.rose,
              paddingHorizontal: spacingX._15,
            }}
          >
            <Icons.TrashIcon
              color={colors.white}
              size={verticalScale(24)}
              weight="bold"
            />
          </Button>
        )}
        <Button onPress={onSubmit} loading={loading} style={{ flex: 1 }}>
          <Typo color={colors.black} fontWeight={"700"}>
            {oldWallet?.id ? "Update Wallet" : "Add Wallet"}
          </Typo>
        </Button>
      </View>

      <SheetModal
        visible={quickIconModalVisible}
        title="Pick an icon"
        onClose={() => setQuickIconModalVisible(false)}
      >
        <ScrollView
          style={{ maxHeight: verticalScale(430) }}
          contentContainerStyle={styles.quickIconSheetContent}
          showsVerticalScrollIndicator={false}
        >
          {QUICK_ICON_GROUPS.map((group) => (
            <View key={group.category} style={styles.quickIconSection}>
              <Typo
                size={12}
                fontWeight={"800"}
                color={colors.neutral400}
                style={styles.quickIconSectionTitle}
              >
                {group.title}
              </Typo>

              {group.options.map((option, index) => {
                const isSelected = wallet.image === option.image;
                const isLastInSection = index === group.options.length - 1;
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.85}
                    style={[
                      styles.quickIconRow,
                      isSelected && styles.quickIconRowSelected,
                      isLastInSection && styles.quickIconRowLast,
                    ]}
                    onPress={() => onSelectQuickIcon(option)}
                  >
                    <View style={styles.quickIconRowLeft}>
                      <View style={styles.quickIconPreview}>
                        <Image
                          style={styles.quickIconImage}
                          source={option.image}
                          contentFit="contain"
                          transition={100}
                        />
                      </View>

                      <View style={styles.quickIconTextBlock}>
                        <Typo
                          fontWeight={"700"}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {option.label}
                        </Typo>
                        <Typo
                          size={12}
                          color={colors.neutral400}
                          numberOfLines={1}
                        >
                          {option.domain}
                        </Typo>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.quickIconCheck,
                        isSelected && styles.quickIconCheckSelected,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SheetModal>
    </ModalWrapper>
  );
};

export default WalletModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacingY._20,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
    borderTopWidth: 1,
  },
  form: {
    gap: spacingY._30,
    marginTop: spacingY._15,
    paddingBottom: spacingY._60,
  },
  avatarContainer: {
    position: "relative",
    alignSelf: "center",
  },
  avatar: {
    width: verticalScale(135),
    borderRadius: 200,
    borderWidth: 1,
    borderColor: colors.neutral500,
  },
  editIcon: {
    position: "absolute",
    bottom: spacingY._5,
    right: spacingY._7,
    borderRadius: 100,
    backgroundColor: colors.neutral100,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    elevation: 4,
    padding: spacingY._7,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  quickIconPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: scale(12),
    backgroundColor: colors.neutral800,
    minHeight: verticalScale(56),
    paddingHorizontal: spacingX._10,
    gap: scale(10),
  },
  quickIconPickerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  quickIconTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  quickIconPreview: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(10),
    overflow: "hidden",
    backgroundColor: colors.neutral700,
    borderWidth: 1,
    borderColor: colors.neutral600,
  },
  quickIconImage: {
    flex: 1,
  },
  quickIconSheetContent: {
    paddingTop: spacingY._5,
    gap: spacingY._10,
  },
  quickIconSection: {
    borderWidth: 1,
    borderColor: colors.neutral800,
    borderRadius: scale(12),
    overflow: "hidden",
    backgroundColor: colors.neutral900,
  },
  quickIconSectionTitle: {
    backgroundColor: colors.neutral800,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._7,
  },
  quickIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(12),
    paddingVertical: spacingY._12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral800,
    paddingHorizontal: spacingX._12,
  },
  quickIconRowSelected: {
    backgroundColor: "rgba(163, 230, 53, 0.08)",
  },
  quickIconRowLast: {
    borderBottomWidth: 0,
  },
  quickIconRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  quickIconCheck: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: colors.neutral500,
    backgroundColor: "transparent",
  },
  quickIconCheckSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
