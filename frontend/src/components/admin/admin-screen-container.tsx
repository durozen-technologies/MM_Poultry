import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
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
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      {header}
      
      {noScroll ? (
        <Animated.View entering={FadeInDown.springify().damping(20).delay(100)} className="flex-1 z-20">
          {children}
        </Animated.View>
      ) : (
        <KeyboardAwareScrollView 
          enableOnAndroid={true}
          keyboardShouldPersistTaps="handled"
          className="flex-1 px-4 -mt-4 z-20" 
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          <Animated.View entering={FadeInDown.springify().damping(20).delay(100)} className="flex-col gap-5 pt-4">
            {children}
          </Animated.View>
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}
