import React from "react";
import { Text, View } from "react-native";
import type { DispatchItemSummary } from "../../types/api";

export function formatDispatchItemLine(item: DispatchItemSummary, prefix?: string) {
  const boxes = item.total_boxes ?? 0;
  const kg = Number(item.total_kg ?? 0);
  const label = item.item_name ?? "Item";
  const line = `${boxes} Box · ${kg.toFixed(1)} kg`;
  return prefix ? `${prefix} ${label}: ${line}` : `${label}: ${line}`;
}

export function DispatchItemSummaryList({
  items,
  emptyLabel,
  className,
}: {
  items: DispatchItemSummary[];
  emptyLabel?: string;
  className?: string;
}) {
  if (!items.length) {
    return emptyLabel ? (
      <Text className="text-sm text-on-surface-variant">{emptyLabel}</Text>
    ) : null;
  }

  return (
    <View className={className}>
      {items.map((item) => (
        <Text key={item.item_id} className="text-sm text-on-surface-variant">
          <Text className="font-semibold text-on-surface">{item.item_name ?? "Item"}</Text>
          {" — "}
          {item.total_boxes ?? 0} Box · {Number(item.total_kg ?? 0).toFixed(1)} kg
        </Text>
      ))}
    </View>
  );
}
