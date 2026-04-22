import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import Navigation from "../components/navigation";
import socket, {
    connectSocket,
    disconnectSocket,
    onLocationUpdate,
} from "../utils/socket";

const DEEP_BLUE = "#165C9C";
const PRIMARY_BLUE = "#4FA3FF";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Default map region (Kathmandu, Nepal)
const DEFAULT_REGION = {
  latitude: 27.7172,
  longitude: 85.324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

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

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ routeId?: string }>();
  const mapRef = useRef<MapView>(null);

  const [busLocation, setBusLocation] = useState<BusLocation | null>(null);
  const [locationTrail, setLocationTrail] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<number | null>(
    params.routeId ? Number(params.routeId) : null,
  );
  const [followBus, setFollowBus] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  // Route selection fallback
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<RouteOption[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // ETA state
  const [stopETAs, setStopETAs] = useState<StopETA[]>([]);
  const [liveRoutePath, setLiveRoutePath] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const etaFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decode JWT to get user info
  const getUserInfo = async (): Promise<{
    routeId: number | null;
    role: string | null;
    childrenRouteIds: number[];
  }> => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return { routeId: null, role: null, childrenRouteIds: [] };
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      const payload = JSON.parse(jsonPayload);
      console.log("[MAP] JWT decoded payload:", JSON.stringify(payload));

      // Direct routeId from token
      let directRouteId = payload?.RouteId ?? payload?.routeId ?? null;

      // For parents: extract route IDs from children
      const childrenRouteIds: number[] = [];
      if (Array.isArray(payload?.children)) {
        for (const child of payload.children) {
          if (child.routeId) childrenRouteIds.push(Number(child.routeId));
        }
      }

      // Also check AsyncStorage for children route IDs (set during login)
      if (childrenRouteIds.length === 0) {
        try {
          const stored = await AsyncStorage.getItem("childrenRouteIds");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              parsed.forEach((id: any) => {
                if (id) childrenRouteIds.push(Number(id));
              });
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Also check AsyncStorage for assigned routeId
      if (!directRouteId) {
        const storedRouteId = await AsyncStorage.getItem("assignedRouteId");
        if (storedRouteId) directRouteId = Number(storedRouteId);
      }

      const info = {
        routeId: directRouteId,
        role: payload?.role ?? payload?.Role ?? null,
        childrenRouteIds,
      };
      console.log("[MAP] User info from token:", JSON.stringify(info));
      return info;
    } catch (e) {
      console.error("[MAP] Failed to decode JWT:", e);
      return { routeId: null, role: null, childrenRouteIds: [] };
    }
  };

  // Fetch available routes for route selection
  const fetchRoutes = useCallback(async () => {
    try {
      setLoadingRoutes(true);
      const token = await AsyncStorage.getItem("authToken");
      console.log(
        "[MAP] Fetching routes from:",
        `${API_BASE_URL}/api/routes/get-routes`,
      );
      console.log("[MAP] Token present:", !!token);
      const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      console.log("[MAP] Routes response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[MAP] Routes data received:", JSON.stringify(data));
        setAvailableRoutes(data.routes ?? []);
      } else {
        const text = await res.text();
        console.warn("[MAP] Routes fetch failed:", res.status, text);
      }
    } catch (err) {
      console.error("[MAP] Routes fetch error:", err);
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  // Fetch location history trail for trip
  const fetchLocationTrail = useCallback(async (tripId: number) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      console.log("[MAP] Fetching location trail for tripId:", tripId);
      const res = await fetch(`${API_BASE_URL}/api/trips/locations/${tripId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      console.log("[MAP] Trail response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        const trail = (data.locations ?? []).map((loc: any) => ({
          latitude: loc.Latitude,
          longitude: loc.Longitude,
        }));
        console.log("[MAP] Trail points received:", trail.length);
        setLocationTrail(trail);
      } else {
        console.warn("[MAP] Trail fetch failed:", res.status);
      }
    } catch (err) {
      console.error("[MAP] Trail fetch error:", err);
    }
  }, []);

  // Fetch active trip for a route
  const fetchActiveTrip = useCallback(
    async (rId: number) => {
      try {
        setError(null);
        const token = await AsyncStorage.getItem("authToken");

        // Also fetch route stops
        try {
          const stopsRes = await fetch(
            `${API_BASE_URL}/api/routes/${rId}/details`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (stopsRes.ok) {
            const stopsData = await stopsRes.json();
            if (stopsData.stops) {
              setRouteStops(stopsData.stops);
            }
          }
        } catch (e) {
          console.error("[MAP] Error fetching stops:", e);
        }

        console.log("[MAP] Fetching active trip for routeId:", rId);
        console.log(
          "[MAP] API URL:",
          `${API_BASE_URL}/api/trips/active/${rId}`,
        );
        const res = await fetch(`${API_BASE_URL}/api/trips/active/${rId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("[MAP] Active trip response status:", res.status);

        if (!res.ok) {
          const errorText = await res.text();
          console.warn(
            "[MAP] No active trip. Server response:",
            res.status,
            errorText,
          );
          setTripInfo(null);
          setBusLocation(null);
          setLocationTrail([]);
          setError("No active trip on this route right now.");
          return;
        }

        const data = await res.json();
        console.log("[MAP] Active trip data:", JSON.stringify(data, null, 2));
        console.log("[MAP] Trip ID:", data.trip?.TripId);
        console.log("[MAP] Route:", data.trip?.route?.Name);
        console.log("[MAP] Bus:", data.trip?.bus?.BusNumber);
        console.log("[MAP] Driver:", data.trip?.driver?.Name);
        console.log(
          "[MAP] Latest location:",
          JSON.stringify(data.latestLocation),
        );
        setTripInfo(data.trip);

        if (data.latestLocation) {
          const loc: BusLocation = {
            tripId: data.trip.TripId,
            latitude: data.latestLocation.Latitude,
            longitude: data.latestLocation.Longitude,
            driverId: data.trip.DriverId,
            timestamp: new Date().toISOString(),
          };
          console.log(
            "[MAP] Setting initial bus location:",
            JSON.stringify(loc),
          );
          setBusLocation(loc);
        } else {
          console.log("[MAP] No latest location available yet");
        }

        // Fetch existing trail
        await fetchLocationTrail(data.trip.TripId);
      } catch (err) {
        console.error("[MAP] fetchActiveTrip error:", err);
        setError("Failed to load trip data. Check your connection.");
      }
    },
    [fetchLocationTrail],
  );

  // Calculate ETAs from bus to ALL stops via OSRM
  // Uses OSRM for accurate road distance, then calculates time at realistic bus speed
  const AVG_BUS_SPEED_KMH = 25; // Average bus speed in km/h (accounts for stops, traffic, slower speed)

  const fetchETAs = useCallback(
    async (busLat: number, busLng: number) => {
      if (routeStops.length === 0) return;
      try {
        const sortedStops = [...routeStops].sort(
          (a, b) => a.sequenceOrder - b.sequenceOrder,
        );

        // Determine which stops the bus has actually passed using the location trail.
        const PASS_THRESHOLD = 0.0015; // ~150m in lat/lng degrees
        const passedStopIds = new Set<number>();

        if (locationTrail.length > 5) {
          for (const stop of sortedStops) {
            let wasClose = false;
            let closestTrailIdx = -1;
            let closestDist = Infinity;

            for (let t = 0; t < locationTrail.length; t++) {
              const dx = locationTrail[t].latitude - stop.latitude;
              const dy = locationTrail[t].longitude - stop.longitude;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < closestDist) {
                closestDist = dist;
                closestTrailIdx = t;
              }
              if (dist < PASS_THRESHOLD) {
                wasClose = true;
              }
            }

            if (wasClose && closestTrailIdx < locationTrail.length - 3) {
              passedStopIds.add(stop.id);
            }
          }
        }

        // Get upcoming stops (not passed), keep route sequence order
        const upcomingStops = sortedStops.filter(
          (s) => !passedStopIds.has(s.id),
        );
        const etas: StopETA[] = [];

        // Mark passed stops
        for (const stop of sortedStops) {
          if (passedStopIds.has(stop.id)) {
            etas.push({
              stopId: stop.id,
              stopName: stop.name,
              durationSeconds: 0,
              distanceMeters: 0,
              passed: true,
            });
          }
        }

        // For upcoming stops: get road distance from bus to each stop, calculate ETA at bus speed
        if (upcomingStops.length > 0) {
          // Get the road-snapped route line (bus ΓåÆ stops in sequence for the polyline)
          const seqCoords = [
            `${busLng},${busLat}`,
            ...upcomingStops.map((s) => `${s.longitude},${s.latitude}`),
          ].join(";");

          const seqRes = await fetch(
            `${API_BASE_URL}/api/routes/utility/osrm-route?coords=${seqCoords}&overview=full&geometries=geojson&steps=false`,
          );

          if (seqRes.ok) {
            const seqData = await seqRes.json();
            if (seqData.routes && seqData.routes.length > 0) {
              if (seqData.routes[0].geometry) {
                const roadCoords = seqData.routes[0].geometry.coordinates.map(
                  (c: number[]) => ({
                    latitude: c[1],
                    longitude: c[0],
                  }),
                );
                setLiveRoutePath(roadCoords);
              }
            }
          }

          // Get road distance from bus to each upcoming stop, then calculate realistic bus ETA
          for (const stop of upcomingStops) {
            try {
              const pairCoords = `${busLng},${busLat};${stop.longitude},${stop.latitude}`;
              const pairRes = await fetch(
                `${API_BASE_URL}/api/routes/utility/osrm-route?coords=${pairCoords}&overview=false&steps=false`,
              );
              if (pairRes.ok) {
                const pairData = await pairRes.json();
                if (pairData.routes && pairData.routes.length > 0) {
                  const distanceMeters = pairData.routes[0].distance;
                  // Calculate time based on realistic bus speed instead of OSRM car speed
                  const distanceKm = distanceMeters / 1000;
                  const timeHours = distanceKm / AVG_BUS_SPEED_KMH;
                  const timeSeconds = timeHours * 3600;
                  etas.push({
                    stopId: stop.id,
                    stopName: stop.name,
                    durationSeconds: timeSeconds,
                    distanceMeters: distanceMeters,
                    passed: false,
                  });
                  continue;
                }
              }
            } catch {
              /* fallback below */
            }

            // Fallback: if individual fetch fails, add without ETA data
            etas.push({
              stopId: stop.id,
              stopName: stop.name,
              durationSeconds: 0,
              distanceMeters: 0,
              passed: false,
            });
          }
        }

        // Sort ETAs back to original sequence order
        const stopOrder = new Map(sortedStops.map((s, i) => [s.id, i]));
        etas.sort(
          (a, b) =>
            (stopOrder.get(a.stopId) ?? 0) - (stopOrder.get(b.stopId) ?? 0),
        );

        setStopETAs(etas);
      } catch (err) {
        console.error("[MAP] ETA fetch error:", err);
      }
    },
    [routeStops, locationTrail],
  );

  // Recalculate ETAs when bus location changes (debounced)
  useEffect(() => {
    if (!busLocation) return;
    if (etaFetchTimer.current) clearTimeout(etaFetchTimer.current);
    etaFetchTimer.current = setTimeout(() => {
      fetchETAs(busLocation.latitude, busLocation.longitude);
    }, 3000); // debounce 3s to avoid flooding OSRM
    return () => {
      if (etaFetchTimer.current) clearTimeout(etaFetchTimer.current);
    };
  }, [busLocation, fetchETAs]);

  // Helper to format duration
  const formatETA = (seconds: number): string => {
    if (seconds < 60) return "< 1 min";
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
  };

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    if (!routeId) return;
    setRefreshing(true);
    await fetchActiveTrip(routeId);
    setRefreshing(false);
  }, [routeId, fetchActiveTrip]);

  // Select a route manually
  const selectRoute = useCallback(
    async (rId: number) => {
      setRouteId(rId);
      setShowRouteSelector(false);
      setLoading(true);
      setError(null);
      setTripInfo(null);
      setBusLocation(null);
      setLocationTrail([]);

      // Join the new route room
      connectSocket(rId);
      await fetchActiveTrip(rId);
      setLoading(false);
    },
    [fetchActiveTrip],
  );

  // Main initialization
  useEffect(() => {
    let cleanupLocationListener: (() => void) | null = null;
    let cleanupTripStarted: (() => void) | null = null;

    const init = async () => {
      console.log("[MAP] ===== MAP INIT START =====");
      console.log("[MAP] API_BASE_URL:", API_BASE_URL);
      console.log("[MAP] Params routeId:", params.routeId);

      // If routeId already passed via params, use it
      let rId = routeId;
      console.log("[MAP] Initial routeId from state:", rId);

      if (!rId) {
        const userInfo = await getUserInfo();
        console.log("[MAP] User info:", JSON.stringify(userInfo));
        rId = userInfo.routeId;

        // If admin or no route, show route selector
        if (!rId) {
          const userRole = userInfo.role;
          console.log("[MAP] No routeId, user role:", userRole);

          // For parents: use children's route (show selector if multiple)
          if (userRole === "parent" && userInfo.childrenRouteIds.length > 0) {
            if (userInfo.childrenRouteIds.length === 1) {
              console.log(
                "[MAP] Parent has 1 child route:",
                userInfo.childrenRouteIds[0],
              );
              rId = userInfo.childrenRouteIds[0];
            } else {
              console.log(
                "[MAP] Parent has multiple child routes, showing selector",
              );
              await fetchRoutes();
              setShowRouteSelector(true);
              setLoading(false);
              return;
            }
          } else if (userRole === "admin" || userRole === "org_admin") {
            console.log("[MAP] Admin detected, showing route selector");
            await fetchRoutes();
            setShowRouteSelector(true);
            setLoading(false);
            return;
          } else {
            console.log("[MAP] No route assigned to user");
            setError("No route assigned to your account. Contact your admin.");
            setLoading(false);
            return;
          }
        }
        setRouteId(rId);
      }

      console.log("[MAP] Using routeId:", rId);

      // Connect socket and join route room
      setConnectionStatus("connecting");
      console.log("[MAP] Connecting socket to route:", rId);
      connectSocket(rId);

      // Track socket connection state
      socket.on("connect", () => {
        console.log("[MAP] Socket CONNECTED, id:", socket.id);
        setConnectionStatus("connected");
      });
      socket.on("disconnect", (reason) => {
        console.log("[MAP] Socket DISCONNECTED, reason:", reason);
        setConnectionStatus("disconnected");
      });
      socket.on("connect_error", (err) => {
        console.error("[MAP] Socket CONNECT_ERROR:", err.message);
        setConnectionStatus("disconnected");
      });

      // Fetch current active trip
      await fetchActiveTrip(rId);
      setLoading(false);

      // Listen for real-time location updates
      console.log("[MAP] Registering location-update listener");
      cleanupLocationListener = onLocationUpdate((data) => {
        console.log(
          "[MAP] >>> LIVE location-update received:",
          JSON.stringify(data),
        );
        setBusLocation(data);

        // Add to trail
        setLocationTrail((prev) => [
          ...prev,
          { latitude: data.latitude, longitude: data.longitude },
        ]);

        // Auto-follow bus on map
        if (followBus) {
          mapRef.current?.animateToRegion(
            {
              latitude: data.latitude,
              longitude: data.longitude,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            },
            600,
          );
        }
      });

      // Listen for trip started notification
      socket.on("notification", (data: any) => {
        console.log(
          "[MAP] >>> Socket notification received:",
          JSON.stringify(data),
        );
        if (data.type === "trip_started") {
          console.log("[MAP] Trip started! Refreshing data...");
          if (rId) fetchActiveTrip(rId);
        } else if (data.type === "trip_ended") {
          console.log("[MAP] Trip ended! Clearing tracking.");
          setTripInfo(null);
          setBusLocation(null);
          setLocationTrail([]);
          setError("Trip has ended. The bus has completed its route.");
        }
      });
      cleanupTripStarted = () => socket.off("notification");
    };

    init();

    return () => {
      if (cleanupLocationListener) cleanupLocationListener();
      if (cleanupTripStarted) cleanupTripStarted();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centerOnBus = () => {
    if (busLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: busLocation.latitude,
          longitude: busLocation.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500,
      );
      setFollowBus(true);
    }
  };

  // Connection status color
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
          /* Route Selection Fallback */
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
          /* Map View */
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              initialRegion={
                busLocation
                  ? {
                      latitude: busLocation.latitude,
                      longitude: busLocation.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  : DEFAULT_REGION
              }
              showsUserLocation
              showsMyLocationButton={false}
              onPanDrag={() => setFollowBus(false)}
            >
              {/* Route from bus to remaining stops (single clean line) */}
              {liveRoutePath.length > 1 ? (
                <Polyline
                  coordinates={liveRoutePath}
                  strokeColor="#3B82F6"
                  strokeWidth={4}
                />
              ) : routeStops.length > 1 ? (
                <Polyline
                  coordinates={routeStops
                    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                    .map((s) => ({
                      latitude: s.latitude,
                      longitude: s.longitude,
                    }))}
                  strokeColor="#888888"
                  strokeWidth={3}
                  lineDashPattern={[10, 5]}
                />
              ) : null}

              {/* Landmark/Stop Markers with Names + ETA */}
              {routeStops.map((stop, index) => {
                const eta = stopETAs.find((e) => e.stopId === stop.id);
                return (
                  <Marker
                    key={stop.id}
                    coordinate={{
                      latitude: stop.latitude,
                      longitude: stop.longitude,
                    }}
                    title={stop.name}
                    description={
                      eta
                        ? eta.passed
                          ? `Passed`
                          : `ETA: ${formatETA(eta.durationSeconds)}`
                        : `Stop ${stop.sequenceOrder}`
                    }
                    anchor={{ x: 0.5, y: 1.0 }}
                  >
                    <View style={{ alignItems: "center" }}>
                      <View
                        style={{
                          backgroundColor: "#FFF",
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginBottom: 4,
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 2,
                          borderWidth: 1,
                          borderColor: eta?.passed ? "#ccc" : "#ddd",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "bold",
                            color: eta?.passed ? "#aaa" : "#333",
                          }}
                        >
                          {stop.name}
                        </Text>
                        {eta && (
                          <Text
                            style={{
                              fontSize: 9,
                              color: eta.passed ? "#22c55e" : "#3B82F6",
                              fontWeight: "600",
                              marginTop: 1,
                            }}
                          >
                            {eta.passed
                              ? "Γ£ô Passed"
                              : `~${formatETA(eta.durationSeconds)}`}
                          </Text>
                        )}
                      </View>
                      <View
                        style={{
                          backgroundColor: eta?.passed ? "#9CA3AF" : "#FBBF24",
                          borderRadius: 12,
                          width: 24,
                          height: 24,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 2,
                          borderColor: "#FFF",
                          elevation: 5,
                        }}
                      >
                        {eta?.passed ? (
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        ) : (
                          <Text
                            style={{
                              color: "#000",
                              fontWeight: "bold",
                              fontSize: 12,
                            }}
                          >
                            {index + 1}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Marker>
                );
              })}

              {/* Start location marker */}
              {locationTrail.length > 0 && (
                <Marker
                  coordinate={locationTrail[0]}
                  title="Trip Start"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.startMarker}>
                    <Ionicons name="flag" size={14} color="#FFF" />
                  </View>
                </Marker>
              )}

              {/* Bus live location marker */}
              {busLocation && (
                <Marker
                  coordinate={{
                    latitude: busLocation.latitude,
                    longitude: busLocation.longitude,
                  }}
                  title={tripInfo ? `Bus ${tripInfo.bus.BusNumber}` : "Bus"}
                  description={
                    tripInfo
                      ? `Driver: ${tripInfo.driver.Name} | Route: ${tripInfo.route.Name}`
                      : "Live tracking"
                  }
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.busMarker}>
                    <Ionicons name="bus" size={22} color="#FFF" />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Map overlay buttons */}
            <View style={styles.mapOverlayButtons}>
              {/* Center on bus */}
              {busLocation && (
                <TouchableOpacity
                  style={[
                    styles.overlayButton,
                    !followBus && styles.overlayButtonInactive,
                  ]}
                  onPress={centerOnBus}
                >
                  <Ionicons
                    name="locate"
                    size={22}
                    color={followBus ? DEEP_BLUE : "#999"}
                  />
                </TouchableOpacity>
              )}

              {/* Change route button */}
              <TouchableOpacity
                style={styles.overlayButton}
                onPress={async () => {
                  await fetchRoutes();
                  setShowRouteSelector(true);
                }}
              >
                <Ionicons name="swap-horizontal" size={22} color={DEEP_BLUE} />
              </TouchableOpacity>
            </View>

            {/* Trip info card */}
            {tripInfo && (
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  {tripInfo.route && (
                    <Text style={styles.routeBadge}>{tripInfo.route.Name}</Text>
                  )}
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="bus" size={18} color={DEEP_BLUE} />
                  <Text style={styles.infoText}>
                    Bus #{tripInfo.bus.BusNumber}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={18} color={DEEP_BLUE} />
                  <Text style={styles.infoText}>{tripInfo.driver.Name}</Text>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() =>
                      Alert.alert("Driver Phone", tripInfo.driver.Phone)
                    }
                  >
                    <Ionicons name="call" size={14} color="#22c55e" />
                  </TouchableOpacity>
                </View>
                {!busLocation && (
                  <View style={styles.infoRow}>
                    <Ionicons name="hourglass" size={16} color="#f59e0b" />
                    <Text style={[styles.infoSubText, { color: "#f59e0b" }]}>
                      Waiting for driver&apos;s GPS signal...
                    </Text>
                  </View>
                )}

                {/* ETA to all stops */}
                {stopETAs.length > 0 && (
                  <View style={styles.etaSection}>
                    <View style={styles.etaDivider} />
                    <View style={styles.etaHeader}>
                      <Ionicons
                        name="navigate"
                        size={14}
                        color={PRIMARY_BLUE}
                      />
                      <Text style={styles.etaHeaderText}>
                        Estimated Arrival
                      </Text>
                    </View>
                    {stopETAs.map((eta) => (
                      <View key={eta.stopId} style={styles.etaRow}>
                        <View
                          style={[
                            styles.etaStopDot,
                            eta.passed && { backgroundColor: "#22c55e" },
                          ]}
                        />
                        <Text
                          style={[
                            styles.etaStopName,
                            eta.passed && {
                              color: "#aaa",
                              textDecorationLine: "line-through",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {eta.stopName}
                        </Text>
                        <Text
                          style={[
                            styles.etaTime,
                            eta.passed && { color: "#22c55e" },
                          ]}
                        >
                          {eta.passed
                            ? "Γ£ô"
                            : `~${formatETA(eta.durationSeconds)}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Error / no trip overlay */}
            {error && !tripInfo && (
              <View style={styles.errorCard}>
                <Ionicons name="information-circle" size={32} color="#F39C12" />
                <Text style={styles.errorTitle}>No Active Trip</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRefresh}
                >
                  <Ionicons name="refresh" size={18} color="#FFF" />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  connectionDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: "600",
  },
  refreshButton: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },

  // Bus marker
  busMarker: {
    backgroundColor: DEEP_BLUE,
    borderRadius: 22,
    padding: 8,
    borderWidth: 3,
    borderColor: "#FFF",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },

  // Start marker
  startMarker: {
    backgroundColor: "#22c55e",
    borderRadius: 14,
    padding: 5,
    borderWidth: 2,
    borderColor: "#FFF",
    elevation: 4,
  },

  // Map overlay buttons
  mapOverlayButtons: {
    position: "absolute",
    top: 16,
    right: 16,
    gap: 10,
  },
  overlayButton: {
    backgroundColor: "#FFF",
    borderRadius: 25,
    padding: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  overlayButtonInactive: {
    opacity: 0.6,
  },

  // Trip info card
  infoCard: {
    position: "absolute",
    bottom: 110, // Increased to clearly sit above the bottom Navigation bar
    left: 16,
    right: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 1,
  },
  routeBadge: {
    backgroundColor: "#eff6ff",
    color: DEEP_BLUE,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  infoSubText: {
    fontSize: 13,
    color: "#888",
  },
  callButton: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    padding: 6,
  },

  // Error card
  errorCard: {
    position: "absolute",
    top: "30%",
    left: 32,
    right: 32,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  errorText: {
    marginTop: 6,
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DEEP_BLUE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 6,
  },
  retryText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // Route selector
  routeSelectorContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  routeSelectorTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
  },
  routeSelectorSubtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  routeList: {
    width: "100%",
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    gap: 12,
  },
  routeCardText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  // ETA styles
  etaSection: {
    marginTop: 4,
  },
  etaDivider: {
    height: 1,
    backgroundColor: "#EEE",
    marginVertical: 8,
  },
  etaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  etaHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY_BLUE,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    gap: 8,
  },
  etaStopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FBBF24",
  },
  etaStopName: {
    flex: 1,
    fontSize: 13,
    color: "#555",
  },
  etaTime: {
    fontSize: 13,
    fontWeight: "700",
    color: DEEP_BLUE,
  },
  etaMore: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },

  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 14,
  },
});
