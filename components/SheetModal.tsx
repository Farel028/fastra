// components/SheetModal.tsx
import Typo from "@/components/Typo";
import { colors, radius, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  BackHandler,
  Keyboard,
  KeyboardEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  keyboardAware?: boolean;
  keyboardOffset?: number;
  portal?: boolean;
}

export default function SheetModal({
  visible,
  title,
  onClose,
  children,
  keyboardAware = true,
  keyboardOffset = 0,
  portal = false,
}: Props) {
  const translateY = useRef(new Animated.Value(500)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const keyboardY = useRef(new Animated.Value(0)).current;
  const mergedTranslateY = useMemo(
    () => Animated.add(translateY, keyboardY),
    [translateY, keyboardY],
  );

  // ---------------- OPEN / CLOSE ----------------
  useEffect(() => {
    if (visible) {
      translateY.setValue(500);
      opacity.setValue(0);
      keyboardY.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(500);
      keyboardY.setValue(0);
    }
  }, [keyboardY, opacity, translateY, visible]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 500,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(keyboardY, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [keyboardY, onClose, opacity, translateY]);

  // ---------------- ANDROID BACK ----------------
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        closeSheet();
        return true; // penting supaya gak balik ke screen sebelumnya
      },
    );

    return () => backHandler.remove();
  }, [closeSheet, visible]);

  // ---------------- KEYBOARD AWARE ----------------
  useEffect(() => {
    if (!visible || !keyboardAware) return;

    const animateKeyboard = (toValue: number, duration = 220) => {
      Animated.timing(keyboardY, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    };

    const onShow = (e: KeyboardEvent) => {
      const kbHeight = Math.max(
        0,
        (e?.endCoordinates?.height ?? 0) - keyboardOffset,
      );
      const duration = Platform.OS === "ios" ? (e?.duration ?? 220) : 220;
      animateKeyboard(-kbHeight, duration);
    };

    const onHide = (e: KeyboardEvent) => {
      const duration = Platform.OS === "ios" ? (e?.duration ?? 200) : 200;
      animateKeyboard(0, duration);
    };

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
      keyboardY.setValue(0);
    };
  }, [keyboardAware, keyboardOffset, keyboardY, visible]);

  // ---------------- SWIPE ANYWHERE ----------------
  const shouldStartSwipe = (_: any, gesture: any) => {
    const dy = Number(gesture?.dy ?? 0);
    const dx = Number(gesture?.dx ?? 0);
    return dy > 6 && Math.abs(dy) > Math.abs(dx);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: shouldStartSwipe,
      onMoveShouldSetPanResponderCapture: shouldStartSwipe,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldClose = gesture.dy > 120 || gesture.vy > 1.2;

        if (shouldClose) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  const content = (
    <View style={StyleSheet.absoluteFill}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.sheet, { transform: [{ translateY: mergedTranslateY }] }]}
      >
        {/* Grabber */}
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Typo fontWeight={"800"} size={16}>
            {title}
          </Typo>

          <TouchableOpacity onPress={closeSheet} style={styles.close}>
            <Icons.XIcon
              size={verticalScale(18)}
              color={colors.white}
              weight="bold"
            />
          </TouchableOpacity>
        </View>

        {children}
      </Animated.View>
    </View>
  );

  if (portal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: spacingY._15,
    right: spacingY._15,
    bottom: spacingY._15,
    backgroundColor: colors.neutral900,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  grabberWrap: {
    alignItems: "center",
    paddingBottom: spacingY._10,
  },
  grabber: {
    width: verticalScale(52),
    height: verticalScale(6),
    borderRadius: verticalScale(6),
    backgroundColor: colors.neutral700,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  close: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: verticalScale(36),
    borderWidth: 1,
    borderColor: colors.neutral700,
    justifyContent: "center",
    alignItems: "center",
  },
});
