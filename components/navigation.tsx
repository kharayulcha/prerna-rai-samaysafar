import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadRole = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join(""),
          );
          const decoded = JSON.parse(jsonPayload);
          setRole(decoded.role || decoded.Role || null);
        }
      } catch (e) {
        console.error("Error loading role for navigation", e);
      }
    };
    loadRole();
  }, []);

  const adminNavItems: NavItem[] = [
    { id: "1", label: "Dashboard", icon: "grid", route: "/dashboard" },
    { id: "2", label: "Schedule", icon: "calendar", route: "/schedule" },
    { id: "3", label: "People", icon: "people", route: "/people" },
    { id: "4", label: "Driver", icon: "car", route: "/driver" },
    { id: "5", label: "Payment", icon: "card", route: "/payment" },
  ];

  const studentNavItems: NavItem[] = [
    { id: "1", label: "Dashboard", icon: "grid", route: "/dashboard" },
    { id: "2", label: "Map", icon: "map", route: "/map" },
    { id: "3", label: "Schedule", icon: "calendar", route: "/schedule" },
  ];

  const driverNavItems: NavItem[] = [
    { id: "1", label: "Dashboard", icon: "grid", route: "/dashboard" },
    { id: "2", label: "Map", icon: "map", route: "/map" },
    { id: "3", label: "Routes", icon: "trail-sign", route: "/routes" },
  ];

  const parentNavItems: NavItem[] = [
    { id: "1", label: "Dashboard", icon: "grid", route: "/dashboard" },
    { id: "2", label: "Map", icon: "map", route: "/map" },
    { id: "3", label: "Bills", icon: "receipt", route: "/billing" },
  ];

  const getNavItems = () => {
    const r = role?.toLowerCase();
    if (r === "student") return studentNavItems;
    if (r === "driver") return driverNavItems;
    if (r === "parent") return parentNavItems;
    return adminNavItems;
  };

  const navItems = getNavItems();

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  const isActive = (route: string) => {
    return pathname === route;
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        {navItems.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              onPress={() => handleNavigation(item.route)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  active && styles.activeIconContainer,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={active ? "#FFFFFF" : DEEP_BLUE}
                />
              </View>
              <Text style={[styles.label, active && styles.activeLabel]}>
                {item.label}
              </Text>
              {active && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(79, 163, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 1000,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 60,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(79, 163, 255, 0.1)",
    marginBottom: 4,
  },
  activeIconContainer: {
    backgroundColor: PRIMARY_BLUE,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    fontSize: 11,
    color: "rgba(22, 92, 156, 0.7)",
    fontWeight: "500",
    marginTop: 2,
  },
  activeLabel: {
    color: DEEP_BLUE,
    fontWeight: "700",
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: PRIMARY_BLUE,
  },
});
