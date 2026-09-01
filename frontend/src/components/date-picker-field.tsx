import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatIstDate, todayIstDate } from "../utils/ist-date";

type Props = {
  label?: string;
  value: Date | null;
  onChange: (next: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  containerStyle?: string;
  inputStyle?: string;
  showIcon?: boolean;
};

/**
 * Strict date entry via native datepicker.
 * Display format is always DD/MM/YYYY (IST calendar).
 */
export function DatePickerField({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  containerStyle = "mb-2",
  inputStyle = "bg-surface border border-outline-variant/30 rounded-lg px-3 py-3",
  showIcon = false,
}: Props) {
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
    }
    if (event.type === "dismissed") {
      setOpen(false);
      return;
    }
    if (selected) {
      const normalized = new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        12,
        0,
        0
      );
      onChange(normalized);
    }
  }

  return (
    <View className={containerStyle}>
      {label ? <Text className="text-on-surface mb-1">{label} (DD/MM/YYYY - IST)</Text> : null}
      {Platform.OS === "web" ? (
        <input
          type="date"
          value={value ? value.toISOString().split("T")[0] : ""}
          onChange={(e: any) => {
            const newDate = new Date(e.target.value);
            if (!isNaN(newDate.getTime())) {
              const normalized = new Date(
                newDate.getFullYear(),
                newDate.getMonth(),
                newDate.getDate(),
                12, 0, 0
              );
              onChange(normalized);
            }
          }}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(115, 115, 115, 0.3)",
            backgroundColor: "transparent",
            color: "inherit",
            fontSize: "16px",
            width: "100%",
            colorScheme: "light",
          }}
        />
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className={`${inputStyle} flex-row items-center justify-between`}
            onPress={() => setOpen(true)}
          >
            <Text className={`text-sm ${value ? "text-on-surface" : "text-on-surface-variant"}`}>
              {value ? formatIstDate(value) : "DD/MM/YYYY"}
            </Text>
            {showIcon && (
              <Text style={{ fontFamily: "Material Icons", fontSize: 18, color: "#9ca3af" }}>&#xe916;</Text>
            )}
          </Pressable>
          {open ? (
            <DateTimePicker
              value={value || todayIstDate()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleChange}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
            />
          ) : null}
          {Platform.OS === "ios" && open ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Button" className="mt-1 self-end" onPress={() => setOpen(false)}>
              <Text className="text-primary font-semibold">Done</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
