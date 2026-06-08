import { colors } from "@/constants/theme";
import { ScreenWrapperProps } from "@/types";
import React from "react";
import { StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ScreenWrapper = ({
  style,
  children,
  safeTop = true,
}: ScreenWrapperProps) => {
  const insets = useSafeAreaInsets();
  const paddingTop = safeTop ? insets.top : 0;
  return (
    <View
      style={[
        { paddingTop, flex: 1, backgroundColor: colors.neutral900 },
        style,
      ]}
    >
      <StatusBar barStyle="light-content" />
      {children}
    </View>
  );
};

export default ScreenWrapper;
