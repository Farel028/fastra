import BackButton from "@/components/BackButton";
import ScreenWrapper from "@/components/ScreenWrapper";
import SheetModal from "@/components/SheetModal";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import {
  discardPendingNotificationImport,
  loadPendingNotificationImportSummary,
  PendingNotificationImport,
  requestNotificationListenerPermission,
  savePendingNotificationImport,
} from "@/services/notificationImportService";
import {
  loadNotificationImportManualAccess,
  saveNotificationImportManualAccess,
} from "@/services/notificationImportStorage";
import { formatRupiah } from "@/utils/common";
import { verticalScale } from "@/utils/styling";
import { useFocusEffect } from "@react-navigation/native";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type SwipeDirection = "left" | "right";

const SWIPE_THRESHOLD = 95;

const getImportPreview = (item: PendingNotificationImport) =>
  item.description ||
  item.text ||
  item.bigText ||
  item.title ||
  "No description";

const formatImportDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${months[date.getMonth()]} ${hour}.${minute}`;
};

const SwipeCard = ({
  item,
  cardWidth,
  index,
  total,
  active,
  busy,
  onSwipe,
}: {
  item: PendingNotificationImport;
  cardWidth: number;
  index: number;
  total: number;
  active: boolean;
  busy: boolean;
  onSwipe: (item: PendingNotificationImport, direction: SwipeDirection) => void;
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardHeight = cardWidth * 0.5625;
  const stackDepth = Math.min(index, 2);
  const stackOffset = stackDepth * verticalScale(10);
  const stackScale = 1 - stackDepth * 0.045;
  const typeColor = item.type === "income" ? "#22C55E" : "#EF4444";
  const source = item.sourceApp || item.sourceLabel;

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [item.id, translateX, translateY]);

  const completeSwipe = (direction: SwipeDirection) => {
    onSwipe(item, direction);
  };

  const pan = Gesture.Pan()
    .enabled(active && !busy)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const shouldSwipe =
        Math.abs(event.translationX) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > 780;

      if (!shouldSwipe) {
        translateX.value = withSpring(0, { damping: 16, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 16, stiffness: 150 });
        return;
      }

      const direction = event.translationX > 0 ? "right" : "left";
      translateX.value = withTiming(
        direction === "right" ? cardWidth * 1.4 : -cardWidth * 1.4,
        {
          duration: 220,
        },
      );
      translateY.value = withTiming(
        event.translationY,
        { duration: 220 },
        () => {
          runOnJS(completeSwipe)(direction);
        },
      );
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-cardWidth, 0, cardWidth],
      [-10, 0, 10],
      Extrapolation.CLAMP,
    );

    return {
      transform: active
        ? [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotate}deg` },
          ]
        : [{ translateY: stackOffset }, { scale: stackScale }],
      opacity: index > 2 ? 0 : 1,
      zIndex: total - index,
    };
  });

  const leftBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -20],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ rotate: "-8deg" }],
  }));

  const rightBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [20, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{ rotate: "8deg" }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={active ? "auto" : "none"}
        style={[
          styles.swipeCard,
          {
            width: cardWidth,
            height: cardHeight,
            top: 0,
          },
          animatedCardStyle,
        ]}
      >
        <Animated.View
          style={[styles.swipeBadge, styles.discardBadge, leftBadgeStyle]}
        >
          <Icons.XIcon
            size={verticalScale(18)}
            color={colors.white}
            weight="bold"
          />
          <Typo size={11} fontWeight={"900"} color={colors.white}>
            BUANG
          </Typo>
        </Animated.View>

        <Animated.View
          style={[styles.swipeBadge, styles.saveBadge, rightBadgeStyle]}
        >
          <Icons.CheckIcon
            size={verticalScale(18)}
            color={colors.black}
            weight="bold"
          />
          <Typo size={11} fontWeight={"900"} color={colors.black}>
            SIMPAN
          </Typo>
        </Animated.View>

        <View style={styles.cardTop}>
          <View style={styles.sourceIcon}>
            <Icons.BellRingingIcon
              size={verticalScale(22)}
              color={colors.black}
              weight="fill"
            />
          </View>
          <View style={styles.cardTitleWrap}>
            <Typo size={15} fontWeight={"900"} numberOfLines={1}>
              {item.sourceLabel}
            </Typo>
            <Typo size={11} color={colors.neutral400} numberOfLines={1}>
              {source}
            </Typo>
          </View>
          <View
            style={[
              styles.typePill,
              { borderColor: typeColor, backgroundColor: `${typeColor}18` },
            ]}
          >
            <Typo size={10} fontWeight={"900"} color={typeColor}>
              {item.type === "income" ? "IN" : "OUT"}
            </Typo>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Typo size={24} fontWeight={"900"} numberOfLines={1}>
            {formatRupiah(item.amount)}
          </Typo>
          <Typo size={12} color={colors.neutral300} numberOfLines={2}>
            {getImportPreview(item)}
          </Typo>
        </View>

        <View style={styles.cardBottom}>
          <Typo size={11} color={colors.neutral500} numberOfLines={1}>
            {formatImportDate(item.notificationTime)}
          </Typo>
          {item.category ? (
            <Typo size={11} color={colors.neutral400} numberOfLines={1}>
              {item.category}
            </Typo>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default function NotificationsPage() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [openingSettings, setOpeningSettings] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [pendingReturnCheck, setPendingReturnCheck] = useState(false);
  const [manualAccessConfirmed, setManualAccessConfirmed] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [pendingImports, setPendingImports] = useState<
    PendingNotificationImport[]
  >([]);
  const [pendingImportCount, setPendingImportCount] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const deckWidth = useMemo(
    () => Math.min(width - spacingX._40, verticalScale(390)),
    [width],
  );
  const deckHeight = deckWidth * 0.5625 + verticalScale(34);
  const visibleImports = pendingImports.slice(0, 3);
  const pendingBadgeLabel =
    pendingImportCount > 99 ? "x99+" : `x${pendingImportCount}`;

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

  const refreshPendingImports = useCallback(async () => {
    if (!user?.uid) {
      setPendingImports([]);
      setPendingImportCount(0);
      return;
    }

    setPendingLoading(true);
    try {
      const summary = await loadPendingNotificationImportSummary(user.uid, 12);
      setPendingImports(summary.items);
      setPendingImportCount(summary.totalCount);
    } finally {
      setPendingLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
      void refreshPendingImports();
    }, [refreshPendingImports, refreshStatus]),
  );

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") {
        void refreshStatus();
        void refreshPendingImports();
      }
    };

    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refreshPendingImports, refreshStatus]);

  const handleSavePending = useCallback(
    async (item: PendingNotificationImport) => {
      if (!user?.uid) return;

      setActingId(item.id);
      try {
        const result = await savePendingNotificationImport(user.uid, item.id);
        if (!result.success) {
          Alert.alert("Notification Import", result.msg ?? "Gagal menyimpan.");
        }
        await refreshPendingImports();
      } finally {
        setActingId(null);
      }
    },
    [refreshPendingImports, user?.uid],
  );

  const handleDiscardPending = useCallback(
    async (item: PendingNotificationImport) => {
      if (!user?.uid) return;

      setActingId(item.id);
      try {
        const result = await discardPendingNotificationImport(
          user.uid,
          item.id,
        );
        if (!result.success) {
          Alert.alert("Notification Import", result.msg ?? "Gagal membuang.");
        }
        await refreshPendingImports();
      } finally {
        setActingId(null);
      }
    },
    [refreshPendingImports, user?.uid],
  );

  const handleSwipe = useCallback(
    (item: PendingNotificationImport, direction: SwipeDirection) => {
      if (direction === "right") {
        void handleSavePending(item);
        return;
      }
      void handleDiscardPending(item);
    },
    [handleDiscardPending, handleSavePending],
  );

  const handleTopAction = (direction: SwipeDirection) => {
    const top = pendingImports[0];
    if (!top || actingId) return;
    handleSwipe(top, direction);
  };

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

  const renderAccessSetup = () => (
    <View style={styles.setupCard}>
      <View style={styles.setupIcon}>
        <Icons.BellIcon
          size={verticalScale(28)}
          color={colors.black}
          weight="fill"
        />
      </View>
      <Typo size={18} fontWeight={"900"} style={{ textAlign: "center" }}>
        Notification access
      </Typo>
      <Typo size={13} color={colors.neutral400} style={{ textAlign: "center" }}>
        Aktifkan akses di Android settings, lalu tandai manual kalau sudah
        nyala.
      </Typo>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.primaryBtn}
        onPress={requestAccess}
        disabled={openingSettings || accessLoading}
      >
        <Typo fontWeight={"900"} color={colors.black}>
          {openingSettings ? "Opening..." : "Grant access"}
        </Typo>
      </TouchableOpacity>
    </View>
  );

  const renderDeck = () => (
    <View style={styles.deckScreen}>
      <View style={[styles.deckStage, { height: deckHeight }]}>
        {pendingLoading && pendingImports.length === 0 ? (
          <View
            style={[
              styles.emptyDeck,
              { width: deckWidth, height: deckWidth * 0.5625 },
            ]}
          >
            <Icons.SpinnerGapIcon
              size={verticalScale(28)}
              color={colors.neutral400}
              weight="bold"
            />
          </View>
        ) : pendingImports.length === 0 ? (
          <View
            style={[
              styles.emptyDeck,
              { width: deckWidth, height: deckWidth * 0.5625 },
            ]}
          >
            <Icons.CheckCircleIcon
              size={verticalScale(34)}
              color={colors.primary}
              weight="fill"
            />
          </View>
        ) : (
          visibleImports
            .map((item, index) => (
              <SwipeCard
                key={item.id}
                item={item}
                cardWidth={deckWidth}
                index={index}
                total={visibleImports.length}
                active={index === 0}
                busy={actingId === item.id}
                onSwipe={handleSwipe}
              />
            ))
            .reverse()
        )}
      </View>

      {pendingImports.length > 0 ? (
        <View style={styles.deckActions}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.roundAction,
              styles.discardAction,
              actingId && styles.disabledAction,
            ]}
            onPress={() => handleTopAction("left")}
            disabled={Boolean(actingId)}
          >
            <Icons.XIcon
              size={verticalScale(26)}
              color={colors.white}
              weight="bold"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.roundAction,
              styles.saveAction,
              actingId && styles.disabledAction,
            ]}
            onPress={() => handleTopAction("right")}
            disabled={Boolean(actingId)}
          >
            <Icons.CheckIcon
              size={verticalScale(26)}
              color={colors.black}
              weight="bold"
            />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BackButton />
          </View>
          <View style={styles.headerTitleRow}>
            <Typo size={22} fontWeight={"600"}>
              Notifications
            </Typo>
          </View>
          {pendingImportCount > 0 ? (
            <View style={styles.headerBadge}>
              <Typo size={11} fontWeight={"900"} color={colors.black}>
                {pendingBadgeLabel}
              </Typo>
            </View>
          ) : null}
        </View>

        {manualAccessConfirmed ? renderDeck() : renderAccessSetup()}

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
              Kalau kamu sudah menyalakan akses, tandai manual supaya Fastra
              lanjut.
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
  header: {
    width: "100%",
    height: verticalScale(44),
    marginVertical: spacingY._10,
    flexDirection: "row",
    alignItems: "center",
  },
  headerLeft: {
    position: "absolute",
    left: 0,
    zIndex: 2,
  },
  headerTitleRow: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: verticalScale(44),
  },
  headerBadge: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: [{ translateY: -verticalScale(11) }],
    minWidth: verticalScale(30),
    height: verticalScale(22),
    borderRadius: verticalScale(22),
    paddingHorizontal: spacingX._7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  setupCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacingY._12,
    paddingBottom: spacingY._60,
  },
  setupIcon: {
    width: verticalScale(58),
    height: verticalScale(58),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  primaryBtn: {
    width: "100%",
    height: verticalScale(48),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    marginTop: spacingY._5,
  },
  deckScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacingY._60,
    gap: spacingY._25,
  },
  deckStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  swipeCard: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    backgroundColor: "#0C111B",
    padding: spacingY._15,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  sourceIcon: {
    width: verticalScale(38),
    height: verticalScale(38),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: spacingY._5,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._5,
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
    gap: spacingY._7,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacingX._10,
  },
  swipeBadge: {
    position: "absolute",
    top: spacingY._15,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
    borderRadius: 999,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._7,
  },
  discardBadge: {
    left: spacingX._15,
    backgroundColor: "#EF4444",
  },
  saveBadge: {
    right: spacingX._15,
    backgroundColor: colors.primary,
  },
  emptyDeck: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C111B",
  },
  deckActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._25,
  },
  roundAction: {
    width: verticalScale(62),
    height: verticalScale(62),
    borderRadius: verticalScale(62),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  discardAction: {
    backgroundColor: "#EF4444",
    borderColor: "#FCA5A5",
  },
  saveAction: {
    backgroundColor: colors.primary,
    borderColor: "#D9F99D",
  },
  disabledAction: {
    opacity: 0.55,
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
