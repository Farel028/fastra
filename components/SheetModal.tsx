import Typo from "@/components/Typo";
import { colors, radius, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import {
  Modal,
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
}

export default function SheetModal({
  visible,
  title,
  onClose,
  children,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Typo fontWeight={"800"} size={16}>
              {title}
            </Typo>

            <TouchableOpacity onPress={onClose} style={styles.close}>
              <Icons.XIcon
                size={verticalScale(18)}
                color={colors.white}
                weight="bold"
              />
            </TouchableOpacity>
          </View>

          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    padding: spacingY._15,
  },
  sheet: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._17,
    padding: spacingY._15,
    gap: spacingY._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
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
