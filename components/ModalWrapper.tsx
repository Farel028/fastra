import { colors, spacingY } from "@/constants/theme";
import { ModalWrapperProps } from "@/types";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const isIos = Platform.OS == "ios";
const ModalWrapper = ({
  style,
  children,
  bg = colors.neutral900,
}: ModalWrapperProps) => {
  return (
    <View style={[styles.container, { backgroundColor: bg }, style && style]}>
        {children}
    </View>
  );
};

export default ModalWrapper;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: isIos ? spacingY._15 : 30,
        paddingBottom: isIos ? spacingY._20 : spacingY._10,
    }
});
