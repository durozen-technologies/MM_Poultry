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
import { AdminEditRetailerScreen } from "../screens/admin/admin-edit-retailer-screen";
import { AdminRetailerProfileScreen } from "../screens/admin/admin-retailer-profile-screen";
import { AdminFarmsScreen } from "../screens/admin/admin-farms-screen";
import { AdminAddFarmScreen } from "../screens/admin/admin-add-farm-screen";
import { AdminFarmProfileScreen } from "../screens/admin/admin-farm-profile-screen";
import { AdminFarmLoadDetailScreen } from "../screens/admin/admin-farm-load-detail-screen";

import { AdminRetailerUsersScreen } from "../screens/admin/admin-retailer-users-screen";
import { AdminFarmEditScreen } from "../screens/admin/admin-farm-edit-screen";
import { AdminFarmPurchaseScreen } from "../screens/admin/admin-farm-purchase-screen";
import { AdminOrdersScreen } from "../screens/admin/admin-orders-screen";
import { AdminOrderDetailScreen } from "../screens/admin/admin-order-detail-screen";
import { AdminSettingsScreen } from "../screens/admin/admin-settings-screen";
import { AdminRatesScreen } from "../screens/admin/admin-rates-screen";
import { AdminVehiclesScreen } from "../screens/admin/admin-vehicles-screen";
import { AdminDeliveryUsersScreen } from "../screens/admin/admin-delivery-users-screen";
import { AdminDeliveryRunsScreen } from "../screens/admin/admin-delivery-runs-screen";
import { AdminReportsScreen } from "../screens/admin/admin-reports-screen";
import { AdminExpensesScreen } from "../screens/admin/admin-expenses-screen";
import { AdminAddExpenseScreen } from "../screens/admin/admin-add-expense-screen";
import { AdminRetailerPortalAccessScreen } from "../screens/admin/admin-retailer-portal-access-screen";
import { AdminItemsScreen } from "../screens/admin/admin-items-screen";

import { DeliveryHomeScreen } from "../screens/delivery/delivery-home-screen";
import { RetailerDashboardScreen } from "../screens/retailer/retailer-dashboard-screen";
import { RetailerOrdersScreen } from "../screens/retailer/retailer-orders-screen";
import { RetailerBillsScreen } from "../screens/retailer/retailer-bills-screen";
import { RetailerLedgerScreen } from "../screens/retailer/retailer-ledger-screen";
import { RetailerProfileScreen } from "../screens/retailer/retailer-profile-screen";
import { RetailerPlaceOrderScreen } from "../screens/retailer/retailer-place-order-screen";
import { RetailerOrderDetailScreen } from "../screens/retailer/retailer-order-detail-screen";
import { RetailerBillDetailScreen } from "../screens/retailer/retailer-bill-detail-screen";
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
        tabBarActiveTintColor: "#012d1d",
        tabBarInactiveTintColor: "#414844",
        tabBarStyle: {
          backgroundColor: "rgba(247, 249, 255, 0.9)",
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

function RetailerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap = "home";
          if (route.name === "Home") iconName = "home";
          else if (route.name === "Orders") iconName = "receipt-long";
          else if (route.name === "Bills") iconName = "description";
          else if (route.name === "Ledger") iconName = "account-balance-wallet";
          else if (route.name === "Profile") iconName = "person";

          return <MaterialIcons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: "#012d1d",
        tabBarInactiveTintColor: "#414844",
        tabBarStyle: {
          backgroundColor: "rgba(247, 249, 255, 0.9)",
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
      <Tab.Screen name="Home" component={RetailerDashboardScreen} />
      <Tab.Screen name="Orders" component={RetailerOrdersScreen} />
      <Tab.Screen name="Bills" component={RetailerBillsScreen} />
      <Tab.Screen name="Ledger" component={RetailerLedgerScreen} />
      <Tab.Screen name="Profile" component={RetailerProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#012d1d" />
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
            <Stack.Screen name="Items" component={AdminItemsScreen} />
            <Stack.Screen name="AddRetailer" component={AdminAddRetailerScreen} />
            <Stack.Screen name="EditRetailer" component={AdminEditRetailerScreen} />
            <Stack.Screen name="RetailerProfile" component={AdminRetailerProfileScreen} />
            <Stack.Screen name="AddFarm" component={AdminAddFarmScreen} />
            <Stack.Screen name="AdminEditFarm" component={AdminFarmEditScreen} />
            <Stack.Screen name="FarmPurchase" component={AdminFarmPurchaseScreen} />
            <Stack.Screen name="OrderDetail" component={AdminOrderDetailScreen} />
            <Stack.Screen name="DeliveryRuns" component={AdminDeliveryRunsScreen} />
            <Stack.Screen name="Reports" component={AdminReportsScreen} />
            <Stack.Screen name="Rates" component={AdminRatesScreen} />
            <Stack.Screen name="Vehicles" component={AdminVehiclesScreen} />
            <Stack.Screen name="DeliveryUsers" component={AdminDeliveryUsersScreen} />
            <Stack.Screen name="AdminRetailerUsers" component={AdminRetailerUsersScreen} />
            <Stack.Screen name="Expenses" component={AdminExpensesScreen} />
            <Stack.Screen name="AdminFarmLoadDetail" component={AdminFarmLoadDetailScreen} />
            <Stack.Screen name="AdminFarmProfile" component={AdminFarmProfileScreen} />

            <Stack.Screen name="AddExpense" component={AdminAddExpenseScreen} />
            <Stack.Screen name="RetailerPortalAccess" component={AdminRetailerPortalAccessScreen} />
          </>
        ) : user.role === "DELIVERY" ? (
          <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreen} />
        ) : (
          <>
            <Stack.Screen name="RetailerTabs" component={RetailerTabNavigator} />
            <Stack.Screen name="PlaceOrder" component={RetailerPlaceOrderScreen} />
            <Stack.Screen name="OrderDetail" component={RetailerOrderDetailScreen} />
            <Stack.Screen name="BillDetail" component={RetailerBillDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
