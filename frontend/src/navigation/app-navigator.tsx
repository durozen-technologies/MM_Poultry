import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "../store/auth-store";
import { MaterialIcons } from "@expo/vector-icons";

import { LoginScreen } from "../screens/auth/login-screen";
import { AdminHomeScreen } from "../screens/admin/admin-home-screen";
import { AdminRetailersScreen } from "../screens/admin/admin-retailers-screen";
import { AdminAddRetailerScreen } from "../screens/admin/admin-add-retailer-screen";
import { AdminRetailerProfileScreen } from "../screens/admin/admin-retailer-profile-screen";
import { AdminFarmsScreen } from "../screens/admin/admin-farms-screen";
import { AdminAddFarmScreen } from "../screens/admin/admin-add-farm-screen";
import { AdminFarmPurchaseScreen } from "../screens/admin/admin-farm-purchase-screen";
import { AdminOrdersScreen } from "../screens/admin/admin-orders-screen";
import { AdminSettingsScreen } from "../screens/admin/admin-settings-screen";

import { DeliveryHomeScreen } from "../screens/delivery/delivery-home-screen";
import { RetailerHomeScreen } from "../screens/retailer/retailer-home-screen";
import { SuperAdminHomeScreen } from "../screens/super-admin/super-admin-home-screen";
import { SuperAdminOrgAdminsScreen } from "../screens/super-admin/super-admin-org-admins-screen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap = "dashboard";
          if (route.name === "Dashboard") iconName = "dashboard";
          else if (route.name === "Retailers") iconName = "store";
          else if (route.name === "Farms") iconName = "agriculture";
          else if (route.name === "Orders") iconName = "receipt-long";
          else if (route.name === "Settings") iconName = "settings";

          return <MaterialIcons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: "#012d1d", // primary
        tabBarInactiveTintColor: "#414844", // on-surface-variant
        tabBarStyle: {
          backgroundColor: "rgba(247, 249, 255, 0.9)", // surface/90
          borderTopColor: "rgba(0,0,0,0.04)",
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "System",
          fontWeight: "600",
          fontSize: 12,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminHomeScreen} />
      <Tab.Screen name="Retailers" component={AdminRetailersScreen} />
      <Tab.Screen name="Farms" component={AdminFarmsScreen} />
      <Tab.Screen name="Orders" component={AdminOrdersScreen} />
      <Tab.Screen name="Settings" component={AdminSettingsScreen} />
    </Tab.Navigator>
  );
}

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
          <>
            <Stack.Screen name="SuperAdminHome" component={SuperAdminHomeScreen} />
            <Stack.Screen name="SuperAdminOrgAdmins" component={SuperAdminOrgAdminsScreen} />
          </>
        ) : user.role === "ADMIN" ? (
          <>
            <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
            <Stack.Screen name="AddRetailer" component={AdminAddRetailerScreen} />
            <Stack.Screen name="RetailerProfile" component={AdminRetailerProfileScreen} />
            <Stack.Screen name="AddFarm" component={AdminAddFarmScreen} />
            <Stack.Screen name="FarmPurchase" component={AdminFarmPurchaseScreen} />
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
