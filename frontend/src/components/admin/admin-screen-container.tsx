import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, KeyboardAvoidingView, Platform, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export function AdminScreenContainer({
  children,
  header,
  noScroll = false,
  refreshControl,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  noScroll?: boolean;
  refreshControl?: React.ReactElement<any>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {header}
      
      {noScroll ? (
        <Animated.View entering={FadeInDown.springify().damping(20).delay(100)} className="flex-1">
          {children}
        </Animated.View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView 
            keyboardShouldPersistTaps="handled"
            className="flex-1 px-4" 
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <Animated.View entering={FadeInDown.springify().damping(20).delay(100)} className="flex-col gap-5 pt-4">
              {children}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
