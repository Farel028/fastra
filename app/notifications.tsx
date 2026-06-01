import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import {
  requestNotificationListenerPermission,
} from "@/services/notificationImportService";
import {
  loadNotificationImportManualAccess,
  saveNotificationImportManualAccess,
} from "@/services/notificationImportStorage";
import { verticalScale } from "@/utils/styling";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  AppStateStatus,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import * as Icons from "phosphor-react-native";

const InboxPill = ({ label, color }: { label: string; color: string }) => (
  <View style={[styles.pill, { borderColor: color, backgroundColor: `${color}14` }]}>
    <Typo size={12} fontWeight={"800"} color={color}>
      {label}
    </Typo>
  </View>
);

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [openingSettings, setOpeningSettings] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [pendingReturnCheck, setPendingReturnCheck] = useState(false);
  const [manualAccessConfirmed, setManualAccessConfirmed] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    if (!user?.uid) {
      setManualAccessConfirmed(false);
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    try {
      const confirmed = await loadNotificationImportManualAccess(user.uid);
      setManualAccessConfirmed(confirmed);
      if (pendingReturnCheck) {
        setShowConfirmSheet(true);
        setPendingReturnCheck(false);
      }
    } finally {
      setAccessLoading(false);
    }
  }, [pendingReturnCheck, user?.uid]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") {
        void refreshStatus();
      }
    };

    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refreshStatus]);

  const requestAccess = async () => {
    setOpeningSettings(true);
    try {
      const opened = await requestNotificationListenerPermission();
      if (opened) {
        setPendingReturnCheck(true);
      }
    } finally {
      setOpeningSettings(false);
    }
  };

  const permissionMessage = useMemo(() => {
    if (accessLoading) return "Loading access state...";
    if (manualAccessConfirmed) {
      return "Kamu sudah menandai akses sebagai nyala. Listener siap dipakai.";
    }
    return "Aktifkan akses di settings lalu tandai manual kalau sudah nyala.";
  }, [accessLoading, manualAccessConfirmed]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Notifications"
          leftIcon={<BackButton />}
          style={{ marginVertical: spacingY._10 }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <Icons.BellIcon
                  size={verticalScale(28)}
                  color={colors.black}
                  weight="fill"
                />
              </View>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo size={18} fontWeight={"900"}>
                  Notification inbox
                </Typo>
                <Typo size={13} color={colors.neutral400}>
                  Imported notifications land here first so you can review before
                  they become final transactions.
                </Typo>
              </View>
            </View>

            <View style={styles.heroMeta}>
              <InboxPill
                label={manualAccessConfirmed ? "Sudah nyala" : "Belum nyala"}
                color={manualAccessConfirmed ? "#22C55E" : "#F59E0B"}
              />
              <InboxPill
                label="Manual confirm"
                color={colors.primary}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: spacingY._5 }}>
                <Typo fontWeight={"900"} size={16}>
                  Special app access
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  {permissionMessage}
                </Typo>
              </View>

              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: manualAccessConfirmed
                      ? "#22C55E"
                      : "#F59E0B",
                  },
                ]}
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.primaryBtn}
                onPress={requestAccess}
                disabled={openingSettings}
              >
                <Typo fontWeight={"900"} color={colors.black}>
                  {openingSettings ? "Opening..." : "Grant access"}
                </Typo>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.secondaryBtn}
                onPress={() => router.push("/notification-import")}
              >
                <Typo fontWeight={"900"} color={colors.white}>
                  Import rules
                </Typo>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Typo fontWeight={"900"} size={16}>
              Inbox review
            </Typo>

            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icons.NotebookIcon
                  size={verticalScale(26)}
                  color={colors.black}
                  weight="fill"
                />
              </View>
              <Typo fontWeight={"900"} size={15}>
                All imported notifications will show up here
              </Typo>
              <Typo size={12} color={colors.neutral400} style={{ textAlign: "center" }}>
                Each item can be accepted, rejected, or edited before it becomes a
                real transaction.
              </Typo>
            </View>

            <View style={styles.bulletList}>
              <Typo color={colors.neutral300}>
                1. Listener captures bank, e-wallet, or test notifications.
              </Typo>
              <Typo color={colors.neutral300}>
                2. Parser extracts amount, text, and suggested wallet.
              </Typo>
              <Typo color={colors.neutral300}>
                3. You decide what gets saved into Fastra.
              </Typo>
            </View>
          </View>

          <View style={styles.card}>
            <Typo fontWeight={"900"} size={16}>
              Where the button goes
            </Typo>
            <Typo size={12} color={colors.neutral400}>
              The main access button lives at the top of this page. A shortcut to
              this page also stays in Settings so it is easy to find again.
            </Typo>
          </View>
        </ScrollView>

        <SheetModal
          visible={showConfirmSheet}
          title="Notification Access"
          onClose={() => setShowConfirmSheet(false)}
        >
          <View style={{ gap: spacingY._12 }}>
            <Typo fontWeight={"900"} size={16}>
              Apakah access sudah menyala?
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              Kami tidak mengecek status otomatis. Kalau kamu sudah menyalakan
              akses, tandai saja manual supaya Fastra lanjut.
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              Izin ini diperlukan supaya listener bisa membaca notifikasi yang
              masuk di perangkat kamu.
            </Typo>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.sheetSecondaryBtn}
                onPress={() => setShowConfirmSheet(false)}
              >
                <Typo fontWeight={"900"} color={colors.white}>
                  Belum
                </Typo>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.sheetPrimaryBtn}
                onPress={async () => {
                  if (!user?.uid) return;
                  await saveNotificationImportManualAccess(user.uid, true);
                  setManualAccessConfirmed(true);
                  setShowConfirmSheet(false);
                }}
              >
                <Typo fontWeight={"900"} color={colors.black}>
                  Sudah nyala
                </Typo>
              </TouchableOpacity>
            </View>
          </View>
        </SheetModal>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    gap: spacingY._12,
    paddingBottom: spacingY._30,
  },
  hero: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._20,
    backgroundColor: colors.neutral900,
    padding: spacingY._15,
    gap: spacingY._12,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -verticalScale(60),
    right: -verticalScale(40),
    width: verticalScale(160),
    height: verticalScale(160),
    borderRadius: verticalScale(160),
    backgroundColor: "#F59E0B22",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    zIndex: 1,
  },
  heroIcon: {
    width: verticalScale(52),
    height: verticalScale(52),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  heroMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._10,
    zIndex: 1,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._7,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    backgroundColor: colors.neutral900,
    padding: spacingY._15,
    gap: spacingY._12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  statusDot: {
    width: verticalScale(12),
    height: verticalScale(12),
    borderRadius: verticalScale(12),
  },
  actionRow: {
    flexDirection: "row",
    gap: spacingX._10,
  },
  primaryBtn: {
    flex: 1,
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  secondaryBtn: {
    flex: 1,
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacingY._12,
    paddingVertical: spacingY._17,
    paddingHorizontal: spacingX._10,
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: "#0C111B",
  },
  emptyIcon: {
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  bulletList: {
    gap: spacingY._5,
  },
  sheetActions: {
    flexDirection: "row",
    gap: spacingX._10,
    marginTop: spacingY._5,
  },
  sheetPrimaryBtn: {
    flex: 1,
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  sheetSecondaryBtn: {
    flex: 1,
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
});
