import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Navigation from "../components/navigation";
import {
    connectSocket,
    onLocationUpdate
} from "../utils/socket";

const DEEP_BLUE = "#165C9C";
const PRIMARY_BLUE = "#4FA3FF";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface BusLocation {
  tripId: number;
  latitude: number;
  longitude: number;
  driverId: number;
  timestamp: string;
}

interface TripInfo {
  TripId: number;
  RouteId: number;
  BusId: number;
  DriverId: number;
  Status: string;
  route: { Name: string };
  bus: { BusNumber: string };
  driver: { Name: string; Phone: string };
}

interface RouteOption {
  RouteId: number;
  Name: string;
}

interface Stop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  sequenceOrder: number;
}

interface StopETA {
  stopId: number;
  stopName: string;
  durationSeconds: number;
  distanceMeters: number;
  passed: boolean;
}

// Web version with simplified UI showing bus location and route info
export default function MapScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ routeId?: string }>();

  const [busLocation, setBusLocation] = useState<BusLocation | null>(null);
  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<number | null>(
    params.routeId ? Number(params.routeId) : null,
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<RouteOption[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [stopETAs, setStopETAs] = useState<StopETA[]>([]);

  const etaFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decode JWT and get user info
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        const decodedToken = token
          ? JSON.parse(atob(token.split(".")[1]))
          : null;
        const user = decodedToken?.user;
        const role = user?.role;

        if (routeId) {
          fetchMapData(routeId);
        } else if (role === "student" || role === "parent") {
          fetchAvailableRoutes();
        } else {
          setShowRouteSelector(true);
          // Attempt to fetch active trip
          fetchActiveTrip(user?.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to initialize map");
        setLoading(false);
      }
    };

    initializeConnection();
  }, []);

  const fetchMapData = async (route: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/routes/${route}/stops`);
      if (!response.ok) throw new Error("Failed to fetch stops");

      const stops = await response.json();
      setRouteStops(stops);
      setRouteId(route);

      // Connect socket for live updates
      connectSocket();
      onLocationUpdate(false, route, (location: any) => {
        setBusLocation(location);
        setConnectionStatus("connected");
      });
      setConnectionStatus("connected");
    } catch (err) {
      console.error("Map data error:", err);
      setError("Failed to load map data");
      setConnectionStatus("disconnected");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTrip = async (userId: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/trips/active?userId=${userId}&filter=current`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.TripId) {
          setTripInfo(data);
          await fetchMapData(data.RouteId);
        } else {
          setShowRouteSelector(true);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Active trip error:", err);
      setShowRouteSelector(true);
      setLoading(false);
    }
  };

  const fetchAvailableRoutes = async () => {
    try {
      setLoadingRoutes(true);
      const response = await fetch(`${API_BASE_URL}/api/routes`);
      if (response.ok) {
        const routes = await response.json();
        setAvailableRoutes(routes);
        setShowRouteSelector(true);
      }
    } catch (err) {
      console.error("Routes fetch error:", err);
      setError("Failed to load routes");
    } finally {
      setLoadingRoutes(false);
      setLoading(false);
    }
  };

  const selectRoute = async (route: number) => {
    setShowRouteSelector(false);
    await fetchMapData(route);
  };

  const handleRefresh = async () => {
    if (routeId) {
      setRefreshing(true);
      await fetchMapData(routeId);
      setRefreshing(false);
    }
  };

  const formatETA = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 1) return "< 1 min";
    if (mins > 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins} min`;
  };

  const connectionColor =
    connectionStatus === "connected"
      ? "#22c55e"
      : connectionStatus === "connecting"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Map</Text>
          <View style={styles.connectionDot}>
            <View style={[styles.dot, { backgroundColor: connectionColor }]} />
            <Text style={[styles.connectionText, { color: connectionColor }]}>
              {connectionStatus === "connected"
                ? "Live"
                : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Offline"}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          {refreshing ? (
            <ActivityIndicator size="small" color={DEEP_BLUE} />
          ) : (
            <Ionicons name="refresh" size={22} color={DEEP_BLUE} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={DEEP_BLUE} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : showRouteSelector ? (
          /* Route Selection */
          <View style={styles.routeSelectorContainer}>
            <Ionicons name="map" size={60} color={DEEP_BLUE} />
            <Text style={styles.routeSelectorTitle}>
              Select a Route to Track
            </Text>
            <Text style={styles.routeSelectorSubtitle}>
              Choose a route to see the live bus location
            </Text>

            {loadingRoutes ? (
              <ActivityIndicator
                size="large"
                color={DEEP_BLUE}
                style={{ marginTop: 20 }}
              />
            ) : (
              <FlatList
                data={availableRoutes}
                keyExtractor={(item) => item.RouteId.toString()}
                style={styles.routeList}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No routes available.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.routeCard}
                    onPress={() => selectRoute(item.RouteId)}
                  >
                    <Ionicons name="navigate" size={20} color={PRIMARY_BLUE} />
                    <Text style={styles.routeCardText}>{item.Name}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        ) : (
          /* Web Map Alternative - Info View */
          <>
            <View style={styles.webMapContainer}>
              <View style={styles.webMapPlaceholder}>
                <Ionicons name="map-outline" size={80} color={PRIMARY_BLUE} />
                <Text style={styles.webMapTitle}>Live Bus Tracking</Text>
                <Text style={styles.webMapSubtitle}>
                  For best experience, use mobile app for interactive maps
                </Text>
              </View>

              {/* Bus Location Info */}
              {busLocation && (
                <View style={styles.locationCard}>
                  <Text style={styles.cardTitle}>Current Bus Location</Text>
                  <View style={styles.locationInfo}>
                    <Text style={styles.coordText}>
                      📍 Latitude: {busLocation.latitude.toFixed(4)}
                    </Text>
                    <Text style={styles.coordText}>
                      📍 Longitude: {busLocation.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Trip Information */}
              {tripInfo && (
                <View style={styles.infoCard}>
                  <Text style={styles.cardTitle}>Trip Details</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Route:</Text>
                    <Text style={styles.value}>{tripInfo.route.Name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Bus:</Text>
                    <Text style={styles.value}>{tripInfo.bus.BusNumber}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Driver:</Text>
                    <Text style={styles.value}>{tripInfo.driver.Name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Status:</Text>
                    <Text
                      style={[
                        styles.value,
                        {
                          color:
                            tripInfo.Status === "active"
                              ? "#22c55e"
                              : "#ef4444",
                        },
                      ]}
                    >
                      {tripInfo.Status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Route Stops */}
              {routeStops.length > 0 && (
                <View style={styles.stopsCard}>
                  <Text style={styles.cardTitle}>Route Stops</Text>
                  <View style={styles.stopsList}>
                    {routeStops.map((stop, index) => {
                      const eta = stopETAs.find((e) => e.stopId === stop.id);
                      return (
                        <View key={stop.id} style={styles.stopItem}>
                          <View style={styles.stopNumber}>{index + 1}</View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.stopName}>{stop.name}</Text>
                            {eta && (
                              <Text style={styles.stopETA}>
                                {eta.passed
                                  ? "✓ Passed"
                                  : `ETA: ~${formatETA(eta.durationSeconds)}`}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  connectionDot: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  refreshButton: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  routeSelectorContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 40,
    backgroundColor: "#f9f9f9",
  },
  routeSelectorTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    color: "#000",
  },
  routeSelectorSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  routeList: {
    width: "100%",
    maxHeight: "70%",
    marginTop: 20,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  routeCardText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  webMapContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-start",
  },
  webMapPlaceholder: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#f0f7ff",
    borderRadius: 12,
    marginBottom: 20,
  },
  webMapTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#165C9C",
    marginTop: 12,
  },
  webMapSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  locationCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  stopsCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#165C9C",
    marginBottom: 12,
  },
  locationInfo: {
    gap: 8,
  },
  coordText: {
    fontSize: 14,
    color: "#333",
  },
  detailRow: {
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
  stopsList: {
    gap: 0,
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
    backgroundColor: "#4FA3FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    color: "#fff",
    fontWeight: "600",
  },
  stopName: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
  },
  stopETA: {
    fontSize: 12,
    color: "#4FA3FF",
    marginTop: 4,
  },
  errorBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});
