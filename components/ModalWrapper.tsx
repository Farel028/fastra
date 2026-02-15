// components/ModalWrapper.tsx
import { colors, radius, spacingY } from "@/constants/theme";
import { ModalWrapperProps } from "@/types";
import { verticalScale } from "@/utils/styling";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  BackHandler,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

type Props = ModalWrapperProps & {
  onClose?: () => void;
  heightRatio?: number;
  swipeAnywhere?: boolean;
  overlayClose?: boolean;
  closeDy?: number;
  closeVy?: number;
  swipeEnabled?: boolean;
};

export default function ModalWrapper({
  style,
  children,
  bg = colors.neutral900,
  onClose,
  heightRatio = 0.85,
  swipeAnywhere = true,
  overlayClose = true,
  closeDy = 140,
  closeVy = 1.2,
  swipeEnabled = true,
}: Props) {
  const { height: H } = useWindowDimensions();
  const SHEET_H = Math.max(200, Math.floor(H * heightRatio));
  const OFFSCREEN = SHEET_H + 80;

  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: OFFSCREEN,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onClose?.());
  };

  // open animation
  useEffect(() => {
    translateY.setValue(OFFSCREEN);
    overlayOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 22,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // android back closes modal (bukan balik ke home)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (!swipeEnabled) return false;
        if (!swipeAnywhere) return false;
        return Math.abs(g.dy) > 6; // biar gak "mantul"
      },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > closeDy || g.vy > closeVy;
        if (shouldClose) closeSheet();
        else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 22,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {overlayClose && (
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        )}
      </Animated.View>

      {/* sheet */}
      <Animated.View
        {...(swipeEnabled && swipeAnywhere ? panResponder.panHandlers : {})}
        style={[
          styles.sheet,
          {
            height: SHEET_H,
            backgroundColor: bg,
            transform: [{ translateY }],
          },
          style,
        ]}
      >
        {/* grabber biar kerasa "sheet" */}
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
        </View>

        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0, // ✅ napak bawah (ga flying)
    borderTopLeftRadius: radius._17,
    borderTopRightRadius: radius._17,
    overflow: "hidden",
    paddingTop: spacingY._10,
  },
  grabberWrap: {
    alignItems: "center",
    paddingBottom: spacingY._10,
  },
  grabber: {
    width: verticalScale(56),
    height: verticalScale(6),
    borderRadius: verticalScale(6),
    backgroundColor: colors.neutral700,
  },
});
