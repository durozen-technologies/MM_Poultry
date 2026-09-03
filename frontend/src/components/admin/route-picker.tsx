import { Pressable, Text, View } from "react-native";
import { useAdminRoutes } from "../../hooks/use-queries";

type Props = {
  value: string | null;
  onChange: (routeId: string | null) => void;
};

export function RoutePicker({ value, onChange }: Props) {
  const { data: routes = [], isLoading } = useAdminRoutes();
  const active = routes.filter((r) => r.is_active);

  return (
    <View className="flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onChange(null)}
        className={`px-3 py-2 rounded-full border ${
          value === null ? "bg-primary border-primary" : "bg-surface border-outline-variant/40"
        }`}
      >
        <Text className={value === null ? "text-on-primary font-semibold" : "text-on-surface"}>
          Unassigned
        </Text>
      </Pressable>
      {isLoading ? (
        <Text className="text-on-surface-variant py-2">Loading routes...</Text>
      ) : (
        active.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onChange(r.id)}
            className={`px-3 py-2 rounded-full border ${
              value === r.id ? "bg-primary border-primary" : "bg-surface border-outline-variant/40"
            }`}
          >
            <Text className={value === r.id ? "text-on-primary font-semibold" : "text-on-surface"}>
              {r.name}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
