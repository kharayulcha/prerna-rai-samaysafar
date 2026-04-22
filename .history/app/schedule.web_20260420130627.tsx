import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface RouteItem {
  id: string;
  name: string;
  time: string;
  days: string;
}

// Web version - simplified schedule without map
export default function ScheduleWeb() {
  const router = useRouter();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [studentSchedule, setStudentSchedule] = useState<any[]>([]);
  const [studentStops, setStudentStops] = useState<any[]>([]);
  const [assignedRouteInfo, setAssignedRouteInfo] = useState<any>(null);

  const getStoredToken = useCallback(async () => {
    return await AsyncStorage.getItem("authToken");
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const rawToken = await getStoredToken();
    const token = rawToken?.startsWith("Bearer ")
      ? rawToken.slice(7)
      : rawToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getStoredToken]);

  const decodeJWT = useCallback((token: string) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }, []);

  const formatTimeStr = (timeStr?: string): string => {
    if (!timeStr) return "N/A";
    try {
      if (timeStr.includes("T")) {
        return new Date(timeStr).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getStoredToken();
      if (!token) return;
      const decoded = decodeJWT(token);
      const role = (decoded?.role || decoded?.Role || "user").toLowerCase();
      setUserRole(role);

      const authHeaders = await getAuthHeaders();

      if (role === "student") {
        const res = await fetch(
          `${API_BASE_URL}/api/routes/student-schedule/view`,
          {
            headers: { ...authHeaders },
          },
        );
        const data = await res.json();
        if (data.schedule) {
          setStudentSchedule(data.schedule);
          setAssignedRouteInfo({
            name: data.routeName,
            driver: data.driver,
            bus: data.bus,
            startTime: formatTimeStr(data.startTime),
          });
          if (data.stops) {
            setStudentStops(data.stops);
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
          headers: { ...authHeaders },
        });
        const data = await res.json();
        const mapped: RouteItem[] = (data.routes || []).map((r: any) => ({
          id: r.RouteId?.toString() ?? Math.random().toString(),
          name: r.Name,
          time: formatTimeStr(r.StartTime),
          days: r.ScheduleDays,
        }));
        setRoutes(mapped);
      }
    } catch (error) {
      console.error("Fetch schedule error:", error);
      Alert.alert("Error", "Failed to fetch schedule");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, getStoredToken, decodeJWT]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
          </TouchableOpacity>
          <Text style={styles.title}>Schedule</Text>
          <View style={{ width: 24 }} />
        </View>

        {userRole === "student" ? (
          <View>
            {assignedRouteInfo && (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Your Assigned Route</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Route:</Text>
                  <Text style={styles.value}>{assignedRouteInfo.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Start Time:</Text>
                  <Text style={styles.value}>
                    {assignedRouteInfo.startTime}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Driver:</Text>
                  <Text style={styles.value}>
                    {assignedRouteInfo.driver || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Bus:</Text>
                  <Text style={styles.value}>
                    {assignedRouteInfo.bus || "N/A"}
                  </Text>
                </View>
              </View>
            )}

            {studentSchedule.length > 0 && (
              <View style={styles.scheduleCard}>
                <Text style={styles.cardTitle}>Schedule Details</Text>
                {studentSchedule.map((sch: any, idx: number) => (
                  <View key={idx} style={styles.scheduleItem}>
                    <Text style={styles.scheduleTime}>
                      {formatTimeStr(sch.StartTime)} -{" "}
                      {formatTimeStr(sch.EndTime)}
                    </Text>
                    <Text style={styles.scheduleDay}>
                      {sch.ScheduleDays || "Daily"}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {studentStops.length > 0 && (
              <View style={styles.stopsCard}>
                <Text style={styles.cardTitle}>Route Stops</Text>
                {studentStops.map((stop: any, idx: number) => (
                  <View key={idx} style={styles.stopItem}>
                    <View style={styles.stopNumber}>
                      <Text style={styles.stopNumberText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={styles.stopName}>
                        {stop.Name || stop.name}
                      </Text>
                      <Text style={styles.stopCoords}>
                        📍 {parseFloat(stop.Latitude || "0").toFixed(4)},{" "}
                        {parseFloat(stop.Longitude || "0").toFixed(4)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View>
            {routes.length > 0 ? (
              <View style={styles.routesCard}>
                <Text style={styles.cardTitle}>Routes</Text>
                {routes.map((route) => (
                  <TouchableOpacity key={route.id} style={styles.routeItem}>
                    <View>
                      <Text style={styles.routeName}>{route.name}</Text>
                      <Text style={styles.routeDetails}>
                        {route.time} • {route.days}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={PRIMARY_BLUE}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={60}
                  color={PRIMARY_BLUE}
                />
                <Text style={styles.emptyText}>No routes available</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: DEEP_BLUE,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: DEEP_BLUE,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  label: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  value: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
  },
  scheduleCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  scheduleItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  scheduleTime: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY_BLUE,
  },
  scheduleDay: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  stopsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY_BLUE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stopNumberText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  stopCoords: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  routesCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  routeName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  routeDetails: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#999",
  },
});
