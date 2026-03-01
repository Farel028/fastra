import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { verticalScale } from "@/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const ForgotPassword = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = first(params.email) ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async () => {
    const normalizedEmail = String(email ?? "").trim();
    if (!normalizedEmail) {
      Alert.alert("Forgot Password", "Please enter your email.");
      return;
    }

    setIsLoading(true);
    const res = await forgotPassword(normalizedEmail);
    setIsLoading(false);

    if (!res.success) {
      Alert.alert("Forgot Password", res.msg || "Failed to send reset email.");
      return;
    }

    Alert.alert(
      "Forgot Password",
      res.msg || "Password reset email has been sent.",
      [
        {
          text: "Back to Login",
          onPress: () => router.back(),
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <BackButton iconSize={28} />

        <View style={{ gap: 5, marginTop: spacingY._20 }}>
          <Typo size={30} fontWeight={"800"}>
            Reset
          </Typo>
          <Typo size={30} fontWeight={"800"}>
            Password
          </Typo>
        </View>

        <View style={styles.form}>
          <Typo size={16} color={colors.textLighter}>
            Enter your account email. We will send a reset link to your inbox.
          </Typo>

          <Input
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            icon={
              <Icons.AtIcon
                size={verticalScale(26)}
                color={colors.neutral300}
                weight="fill"
              />
            }
          />

          <Button loading={isLoading} onPress={handleSubmit}>
            <Typo fontWeight={"700"} color={colors.black} size={21}>
              Send Reset Link
            </Typo>
          </Button>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default ForgotPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacingY._30,
    paddingHorizontal: spacingX._20,
  },
  form: {
    gap: spacingY._20,
  },
});

