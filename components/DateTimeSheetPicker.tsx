import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import SheetModal from "./SheetModal";
import Typo from "./Typo";

type PickerMode = "date" | "time";

type DateTimeSheetPickerProps = {
  visible: boolean;
  title: string;
  value: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
  withTime?: boolean;
  showClear?: boolean;
  onClear?: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

const mergeDatePart = (base: Date, picked: Date, mode: PickerMode) => {
  const next = new Date(base);
  if (mode === "date") {
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    return next;
  }

  next.setHours(
    picked.getHours(),
    picked.getMinutes(),
    picked.getSeconds(),
    picked.getMilliseconds(),
  );
  return next;
};

const DateTimeSheetPicker = ({
  visible,
  title,
  value,
  onClose,
  onConfirm,
  withTime = true,
  showClear = false,
  onClear,
  minimumDate,
  maximumDate,
}: DateTimeSheetPickerProps) => {
  const [draft, setDraft] = useState<Date>(value);
  const [mode, setMode] = useState<PickerMode>("date");

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMode("date");
  }, [value, visible]);

  const dateLabel = useMemo(
    () =>
      draft.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [draft],
  );

  const timeLabel = useMemo(
    () =>
      draft.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [draft],
  );

  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android" && event?.type === "dismissed") return;
    if (!selectedDate) return;

    setDraft((prev) => mergeDatePart(prev, selectedDate, mode));
  };

  const apply = () => {
    onConfirm(new Date(draft));
    onClose();
  };

  return (
    <SheetModal visible={visible} title={title} onClose={onClose}>
      <View style={styles.preview}>
        <Typo size={12} color={colors.neutral400}>
          Selected
        </Typo>
        <Typo fontWeight={"800"}>{dateLabel}</Typo>
        {withTime && (
          <Typo size={16} fontWeight={"900"}>
            {timeLabel}
          </Typo>
        )}
      </View>

      {withTime && (
        <View style={styles.modeRow}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.modePill, mode === "date" && styles.modePillActive]}
            onPress={() => setMode("date")}
          >
            <Typo
              size={13}
              fontWeight={"800"}
              color={mode === "date" ? colors.black : colors.neutral200}
            >
              Date
            </Typo>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.modePill, mode === "time" && styles.modePillActive]}
            onPress={() => setMode("time")}
          >
            <Typo
              size={13}
              fontWeight={"800"}
              color={mode === "time" ? colors.black : colors.neutral200}
            >
              Time
            </Typo>
          </TouchableOpacity>
        </View>
      )}

      <View>
        <DateTimePicker
          themeVariant="dark"
          value={draft}
          mode={withTime ? mode : "date"}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      </View>

      <View style={styles.actions}>
        {showClear && !!onClear && (
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.actionBtn, styles.clearBtn]}
            onPress={() => {
              onClear();
              onClose();
            }}
          >
            <Typo fontWeight={"800"} color={colors.rose}>
              Clear
            </Typo>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.actionBtn, { backgroundColor: colors.neutral700 }]}
          onPress={onClose}
        >
          <Typo fontWeight={"800"}>Cancel</Typo>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={apply}
        >
          <Typo fontWeight={"900"} color={colors.black}>
            Save
          </Typo>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
};

export default DateTimeSheetPicker;

const styles = StyleSheet.create({
  preview: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    borderCurve: "continuous",
    padding: spacingY._12,
    gap: scale(4),
    backgroundColor: colors.neutral900,
  },
  modeRow: {
    flexDirection: "row",
    gap: scale(8),
  },
  modePill: {
    flex: 1,
    height: verticalScale(36),
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral900,
    alignItems: "center",
    justifyContent: "center",
  },
  modePillActive: {
    backgroundColor: colors.neutral200,
    borderColor: colors.neutral200,
  },
  quickBtn: {
    height: verticalScale(32), 
    paddingHorizontal: spacingX._12,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral900,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: scale(10),
  },
  actionBtn: {
    flex: 1,
    height: verticalScale(46),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    flex: 0.9,
    borderWidth: 1,
    borderColor: "#3A1518",
    backgroundColor: "#2A1012",
  },
});
