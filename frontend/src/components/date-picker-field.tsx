import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatIstDate, todayIstDate } from "../utils/ist-date";

type Props = {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
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
    <View className="mb-2">
      <Text className="text-brand-ink mb-1">{label} (DD/MM/YYYY · IST)</Text>
      <Pressable
        className="bg-white border border-brand-leaf/30 rounded-lg px-3 py-3"
        onPress={() => setOpen(true)}
      >
        <Text className="text-brand-ink text-base">{formatIstDate(value || todayIstDate())}</Text>
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
        <Pressable className="mt-1 self-end" onPress={() => setOpen(false)}>
          <Text className="text-brand-leaf font-semibold">Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
