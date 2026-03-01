import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { verticalScale } from "@/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

const RESEND_COOLDOWN_SECONDS = 60;

const Login = () => {
  const emailRef = useRef("");
  const passwordRef = useRef("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const router = useRouter();
  const { login: loginUser, resendVerificationEmail } = useAuth();

  useEffect(() => {
    if (cooldownLeft <= 0) return;

    const timer = setTimeout(() => {
      setCooldownLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownLeft]);

  const handleSubmit = async () => {
    if (!emailRef.current || !passwordRef.current) {
      Alert.alert("Login", "Please fill all the fields");
      return;
    }

    setIsLoading(true);
    const res = await loginUser(emailRef.current, passwordRef.current);
    setIsLoading(false);
    if (!res.success) {
      setShowResendVerification(res.code === "EMAIL_NOT_VERIFIED");
      Alert.alert("Login", res.msg);
      return;
    }

    setShowResendVerification(false);
  };

  const handleForgotPassword = () => {
    const normalizedEmail = emailRef.current.trim();

    router.push({
      pathname: "./forgotPassword",
      params: normalizedEmail ? { email: normalizedEmail } : {},
    });
  };

  const handleResendVerification = async () => {
    if (cooldownLeft > 0 || isResendingVerification) return;

    if (!emailRef.current || !passwordRef.current) {
      Alert.alert(
        "Resend Verification",
        "Please fill email and password first.",
      );
      return;
    }

    setIsResendingVerification(true);
    const res = await resendVerificationEmail(emailRef.current, passwordRef.current);
    setIsResendingVerification(false);

    if (!res.success) {
      Alert.alert("Resend Verification", res.msg || "Failed to resend email.");
      return;
    }

    setCooldownLeft(RESEND_COOLDOWN_SECONDS);
    Alert.alert(
      "Resend Verification",
      res.msg || "Verification email sent. Please check inbox or spam.",
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <BackButton iconSize={28} />

        <View style={{ gap: 5, marginTop: spacingY._20 }}>
          <Typo size={30} fontWeight={"800"}>
            Hey
          </Typo>
          <Typo size={30} fontWeight={"800"}>
            Welcome Back
          </Typo>
        </View>

        <View style={styles.form}>
          <Typo size={16} color={colors.textLighter}>
            Login now to track all your expenses
          </Typo>
          <Input
            placeholder="Enter your email"
            onChangeText={(value) => {
              emailRef.current = value;
              setShowResendVerification(false);
            }}
            icon={
              <Icons.AtIcon
                size={verticalScale(26)}
                color={colors.neutral300}
                weight="fill"
              />
            }
          />
          <Input
            placeholder="Enter your password"
            secureTextEntry
            onChangeText={(value) => {
              passwordRef.current = value;
              setShowResendVerification(false);
            }}
            icon={
              <Icons.LockIcon
                size={verticalScale(26)}
                color={colors.neutral300}
                weight="fill"
              />
            }
          />

          <View style={styles.secondaryActions}>
            <Pressable onPress={handleForgotPassword}>
              <Typo size={14} color={colors.text} style={{ alignSelf: "flex-end" }}>
                Forgot Password?
              </Typo>
            </Pressable>

            {showResendVerification && (
              <Pressable
                onPress={handleResendVerification}
                disabled={cooldownLeft > 0 || isResendingVerification}
              >
                <Typo
                  size={14}
                  color={
                    cooldownLeft > 0 || isResendingVerification
                      ? colors.neutral400
                      : colors.primary
                  }
                  style={{ alignSelf: "flex-end" }}
                >
                  {isResendingVerification
                    ? "Sending verification email..."
                    : cooldownLeft > 0
                      ? `Resend verification in ${cooldownLeft}s`
                      : "Resend verification email"}
                </Typo>
              </Pressable>
            )}
          </View>

          <Button loading={isLoading} onPress={handleSubmit}>
            <Typo fontWeight={"700"} color={colors.black} size={21}>
              Login
            </Typo>
          </Button>
        </View>

        <View style={styles.footer}>
          <Typo size={15}>{"Don't have an account?"}</Typo>
          <Pressable onPress={() => router.push("./register")}>
            <Typo size={15} fontWeight={"700"} color={colors.primary}>
              Sign up
            </Typo>
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacingY._30,
    paddingHorizontal: spacingX._20,
  },
  welcomeText: {
    fontSize: verticalScale(20),
    fontWeight: "500",
    color: colors.text,
  },
  form: {
    gap: spacingY._20,
  },
  secondaryActions: {
    alignItems: "flex-end",
    gap: spacingY._7,
  },
  forgotPassword: {
    textAlign: "right",
    fontWeight: "500",
    color: colors.text,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  footerText: {
    textAlign: "center",
    color: colors.text,
    fontSize: verticalScale(15),
  },
});
