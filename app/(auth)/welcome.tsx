import Button from "@/components/Button";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const Welcome = () => {
  const router = useRouter();
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* top */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("./login")}
          >
            <Typo fontWeight={"500"}>Sign in</Typo>
          </TouchableOpacity>
        </View>

        {/* image */}
        <Animated.Image
          entering={FadeIn.duration(450)}
          source={require("../../assets/images/welcome.png")}
          style={styles.welcomeImage}
          resizeMode="contain"
        />

        {/* footer */}
        <View style={styles.footer}>
          <LinearGradient
            pointerEvents="none"
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            colors={[
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0.06)",
              "rgba(0,0,0,0)",
            ]}
            style={styles.topGlow}
          />
          <Animated.View
            entering={FadeInDown.duration(450).delay(50)}
            style={{ alignItems: "center" }}
          >
            <Typo size={30} fontWeight={"800"}>
              Always take control
            </Typo>
            <Typo size={30} fontWeight={"800"}>
              of your finances
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(450).delay(120)}
            style={{ alignItems: "center", gap: 2 }}
          >
            <Typo size={17} color={colors.textLight}>
              Finances must be arranged to set a better
            </Typo>
            <Typo size={17} color={colors.textLight}>
              lifestyle in future
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(450).delay(190)}
            style={styles.buttonContainer}
          >
            <Button onPress={() => router.push("./register")}>
              <Typo size={22} color={colors.neutral900} fontWeight={"600"}>
                Get Started
              </Typo>
            </Button>
          </Animated.View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },

  topBar: {
    paddingTop: spacingY._7,
    paddingHorizontal: spacingX._20,
    alignItems: "flex-end",
  },

  loginButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },

  welcomeImage: {
    width: "100%",
    height: verticalScale(320),
    alignSelf: "center",
  },

  footer: {
    backgroundColor: colors.neutral900,
    alignItems: "center",
    paddingTop: verticalScale(26),
    paddingBottom: verticalScale(36),
    gap: verticalScale(18),
    position: "relative",
    elevation: 14,
  },

  topGlow: {
    position: "absolute",
    top: -100,
    left: 0,
    right: 0,
    height: 90,
  },

  buttonContainer: {
    width: "100%",
    paddingHorizontal: spacingX._25,
  },
});
