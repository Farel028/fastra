import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { getProfileImage } from "@/services/imageService";
import { updateUser } from "@/services/userService";
import { UserDataType } from "@/types";
import { scale, verticalScale } from "@/utils/styling";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const AVATAR_SIZE = verticalScale(135);

const ProfileModal = () => {
  const { user, updateUserData } = useAuth();
  const router = useRouter();

  const [userData, setUserData] = useState<UserDataType>({
    name: "",
    image: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUserData({
      name: user?.name || "",
      image: user?.image || null,
    });
  }, [user]);

  const avatarSource = useMemo(
    () => getProfileImage(userData.image),
    [userData.image],
  );

  const onPickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      setUserData((prev) => ({ ...prev, image: asset }));
    } catch (e) {
      Alert.alert("Image", "Failed to pick image. Please try again.");
    }
  };

  const onSubmit = async () => {
    const name = userData.name?.trim();

    if (!name) {
      Alert.alert("Profile", "Name can't be empty.");
      return;
    }
    if (!user?.uid) {
      Alert.alert("Profile", "User session not found. Please login again.");
      return;
    }

    setLoading(true);
    const res = await updateUser(user.uid, { ...userData, name });
    setLoading(false);

    if (res.success) {
      updateUserData(user.uid);
      router.back();
    } else {
      Alert.alert("Profile", res.msg || "Failed to update profile.");
    }
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Edit Profile"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarContainer}>
            <Image
              style={styles.avatar}
              source={avatarSource}
              contentFit="cover"
              transition={120}
            />

            <TouchableOpacity
              onPress={onPickImage}
              activeOpacity={0.85}
              style={styles.editIcon}
            >
              <Icons.PencilIcon
                size={verticalScale(18)}
                color={colors.neutral800}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Name</Typo>
            <Input
              placeholder="Name"
              value={userData.name}
              onChangeText={(value) =>
                setUserData((prev) => ({ ...prev, name: value }))
              }
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Button onPress={onSubmit} loading={loading} style={{ flex: 1 }}>
          <Typo color={colors.black} fontWeight={"700"}>
            Update
          </Typo>
        </Button>
      </View>
    </ModalWrapper>
  );
};

export default ProfileModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
  },
  form: {
    gap: spacingY._30,
    marginTop: spacingY._15,
    paddingBottom: spacingY._20,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    borderTopWidth: 1,
    marginBottom: spacingY._5,
  },

  avatarContainer: {
    position: "relative",
    alignSelf: "center",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.neutral500,
  },
  editIcon: {
    position: "absolute",
    bottom: spacingY._5,
    right: spacingY._7,
    borderRadius: 999,
    backgroundColor: colors.neutral100,
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    padding: spacingY._7,
  },

  inputContainer: {
    gap: spacingY._10,
  },
});
