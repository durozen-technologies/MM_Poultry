import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "../store/auth-store";
import { LoginScreen } from "../screens/auth/login-screen";
import { AdminHomeScreen } from "../screens/admin/admin-home-screen";
import { AdminRetailersScreen } from "../screens/admin/admin-retailers-screen";
import { DeliveryHomeScreen } from "../screens/delivery/delivery-home-screen";
import { RetailerHomeScreen } from "../screens/retailer/retailer-home-screen";
import { SuperAdminHomeScreen } from "../screens/super-admin/super-admin-home-screen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-sand">
        <ActivityIndicator color="#2f6b3a" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === "SUPER_ADMIN" ? (
          <Stack.Screen name="SuperAdmin" component={SuperAdminHomeScreen} />
        ) : user.role === "ADMIN" ? (
          <>
            <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
            <Stack.Screen
              name="Retailers"
              component={AdminRetailersScreen}
              options={{ headerShown: true, title: "Retailers" }}
            />
          </>
        ) : user.role === "DELIVERY" ? (
          <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreen} />
        ) : (
          <Stack.Screen name="RetailerHome" component={RetailerHomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
