import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#1D4ED8";
const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.1.73:8004";

interface Stop {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    sequenceOrder: number;
}

interface TripInfo {
    tripId: number;
    startTime: string;
    endTime?: string | null;
    status: string;
    isActive: boolean;
}

interface RouteDetails {
    routeId: number;
    name: string;
    busNumber: string;
    totalStops: number;
    estimatedTime: string;
    scheduledStartTime?: string;
    scheduleDays?: string;
    stops: Stop[];
    description?: string;
    tripInfo?: TripInfo | null;
}

interface TokenPayload {
    userId?: number;
    UserId?: number;
    orgId?: number;
    OrgId?: number;
}

// Haversine formula to calculate distance
const deg2rad = (deg: number) => deg * (Math.PI / 180);

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Format scheduled time (HH:MM format from backend is already formatted)
const formatScheduledTime = (timeStr?: string | null): string => {
    if (!timeStr) return "Not scheduled";
    
    const trimmed = timeStr.trim();
    if (!trimmed) return "Not scheduled";
    
    // If it's already in HH:MM or HH:MM:SS format, return just HH:MM
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
        const hours = String(parseInt(timeMatch[1])).padStart(2, '0');
        return `${hours}:${timeMatch[2]}`;
    }
    
    // If none of the above, return the value as-is
    return trimmed;
};

export default function RoutesScreen() {
    const router = useRouter();
    const [routeDetails, setRouteDetails] = useState<RouteDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    const [currentStopId, setCurrentStopId] = useState<number | null>(null);
    const [nextStop, setNextStop] = useState<Stop | null>(null);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);

    useEffect(() => {
        fetchRouteDetails();
        startLocationTracking();

        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, []);

    const startLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Allow location access to track route progress.');
                return;
            }

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (location) => {
                    setUserLocation(location);
                }
            );
        } catch (error) {
            console.error("Error starting location updates:", error);
        }
    };

    const checkProximityToStops = useCallback((location: Location.LocationObject, stops: Stop[]) => {
        const { latitude, longitude } = location.coords;

        // Sort stops by sequence
        const sortedStops = [...stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

        // Find the closest stop within 200 meters
        let nearestStopId: number | null = null;
        let minDistance = Infinity;

        for (const stop of sortedStops) {
            const distance = getDistanceFromLatLonInKm(
                latitude,
                longitude,
                stop.latitude,
                stop.longitude
            );
            
            if (distance < 0.5) { // Within 500m logic for "current stop area"
               if (distance < minDistance) {
                   minDistance = distance;
                   nearestStopId = stop.id;
               }
            }
        }

        if (nearestStopId) {
            setCurrentStopId(nearestStopId);
            
            // Find next stop logic
            const currentStopIndex = sortedStops.findIndex(s => s.id === nearestStopId);
            if (currentStopIndex !== -1 && currentStopIndex < sortedStops.length - 1) {
                setNextStop(sortedStops[currentStopIndex + 1]);
            } else {
                setNextStop(null);
            }
        }
    }, []);

    // Check proximity whenever location or route details change
    useEffect(() => {
        if (userLocation && routeDetails?.stops) {
            checkProximityToStops(userLocation, routeDetails.stops);
        }
    }, [userLocation, routeDetails, checkProximityToStops]);

    const fetchRouteDetails = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            if (!token) {
                throw new Error("Not authenticated");
            }

            // Decode token to get driver ID
            const decoded = jwtDecode(token.replace("Bearer ", "")) as TokenPayload;
            const driverId = decoded.userId || decoded.UserId;

            if (!driverId) {
                throw new Error("Driver ID not found in token");
            }

            console.log(`[Routes] Fetching assignment for driver ${driverId}`);

            // Get driver assignment
            const assignmentRes = await fetch(
                `${API_BASE_URL}/api/drivers/${driverId}/assignment`,
                {
                    headers: { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` },
                }
            );

            if (!assignmentRes.ok) {
                throw new Error(`Failed to fetch assignment: ${assignmentRes.statusText}`);
            }

            const assignment = await assignmentRes.json();
            console.log(`[Routes] Assignment response:`, assignment);

            if (!assignment.routeId) {
                Alert.alert("No Route", "You have not been assigned a route yet.");
                setLoading(false);
                return;
            }

            // Fetch full route details from a new endpoint (we'll create this)
            const routeRes = await fetch(
                `${API_BASE_URL}/api/routes/${assignment.routeId}/details`,
                {
                    headers: { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` },
                }
            );

            if (!routeRes.ok) {
                const errorData = await routeRes.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to fetch route details: ${routeRes.status}`);
            }

            const routeData = await routeRes.json();
            console.log(`[Routes] Route details:`, routeData);
            console.log(`[Routes] Scheduled Start Time:`, routeData.scheduledStartTime);
            console.log(`[Routes] Trip Info:`, routeData.tripInfo);

            if (!routeData || !routeData.stops) {
                 throw new Error("Invalid route data received");
            }

            setRouteDetails(routeData);
        } catch (error: any) {
            console.error("[Routes] Error fetching route details:", error);
            Alert.alert("Error", error.message || "Failed to load route details");
            setRouteDetails(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY_BLUE} />
                    <Text style={styles.loadingText}>Loading route details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const stops = routeDetails?.stops || [];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={PRIMARY_BLUE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Assigned Routes</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Route Overview Card */}
                {routeDetails && (
                    <View style={styles.routeCard}>
                        <View style={styles.routeHeader}>
                            <View style={styles.busIconContainer}>
                                <Ionicons name="bus" size={24} color="#FFF" />
                            </View>
                            <View>
                                <Text style={styles.routeName}>{routeDetails.name}</Text>
                                <Text style={styles.busNumber}>{routeDetails.busNumber}</Text>
                            </View>
                        </View>
                        <View style={styles.routeStats}>
                            <View style={styles.stat}>
                                <Text style={styles.statLabel}>STOPS</Text>
                                <Text style={styles.statValue}>{routeDetails.totalStops}</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statLabel}>EST. TIME</Text>
                                <Text style={styles.statValue}>{routeDetails.estimatedTime}</Text>
                            </View>
                        </View>

                        {/* Trip Timing Section */}
                        {(routeDetails.scheduledStartTime || routeDetails.tripInfo) && (
                        <View style={styles.tripTimingSection}>
                            <View style={styles.timingRow}>
                                <View style={styles.timingItem}>
                                    <Text style={styles.timingLabel}>SCHEDULED START</Text>
                                    <Text style={styles.timingValue}>
                                        {formatScheduledTime(routeDetails.scheduledStartTime)}
                                    </Text>
                                </View>
                                <View style={styles.timingItem}>
                                    <Text style={styles.timingLabel}>TRIP STATUS</Text>
                                    <View style={[
                                        styles.statusBadge,
                                        routeDetails.tripInfo?.isActive && styles.statusActive
                                    ]}>
                                        <Text style={styles.statusText}>
                                            {routeDetails.tripInfo?.isActive ? 'ACTIVE' : 'IDLE'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            {routeDetails.tripInfo?.isActive && (
                                <View style={styles.activeTripIndicator}>
                                    <View style={styles.activeDot} />
                                    <Text style={styles.activeTripText}>Trip in progress</Text>
                                </View>
                            )}
                        </View>
                        )}

                        {nextStop && (
                             <View style={styles.nextStopBadge}>
                                <Text style={styles.nextStopLabel}>NEXT: {nextStop.name}</Text>
                             </View>
                        )}
                    </View>
                )}

                {/* Stop Timeline */}
                <Text style={styles.sectionTitle}>Route Stops</Text>
                <View style={styles.timelineContainer}>
                    {stops
                        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                        .map((stop, index) => {
                            const isCurrent = currentStopId === stop.id;
                            
                            return (
                            <View key={stop.id} style={styles.timelineItem}>
                                <View style={styles.timelineLeft}>
                                    <View
                                        style={[
                                            styles.timelineDot,
                                            {
                                                backgroundColor: isCurrent ? "#22c55e" : 
                                                    index === 0
                                                        ? "#3b82f6"
                                                        : index === stops.length - 1
                                                            ? "#ef4444"
                                                            : PRIMARY_BLUE,
                                                width: isCurrent ? 20 : 12,
                                                height: isCurrent ? 20 : 12,
                                                borderRadius: isCurrent ? 10 : 6,
                                                borderWidth: isCurrent ? 3 : 0,
                                                borderColor: "#d1fae5",
                                            },
                                        ]}
                                    />
                                    {index !== stops.length - 1 && <View style={styles.timelineLine} />}
                                </View>
                                <View style={styles.timelineRight}>
                                    <View style={styles.stopInfo}>
                                        <Text style={[styles.stopName, isCurrent && styles.activeStopText]}>
                                            {stop.name}
                                        </Text>
                                        <Text style={styles.stopNumber}>
                                            {isCurrent ? "You are here" : `Stop ${stop.sequenceOrder}`}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )})}
                </View>
            </ScrollView>

            <Navigation />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#EEE",
        elevation: 2,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
    },
    content: {
        flex: 1,
        padding: 20,
    },
    routeCard: {
        backgroundColor: PRIMARY_BLUE,
        borderRadius: 20,
        padding: 24,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        marginBottom: 24,
    },
    routeHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        marginBottom: 24,
    },
    busIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    routeName: {
        color: "#FFF",
        fontSize: 18,
        fontWeight: "bold",
    },
    busNumber: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: 14,
        marginTop: 4,
    },
    routeStats: {
        flexDirection: "row",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderRadius: 12,
        padding: 16,
    },
    stat: {
        flex: 1,
    },
    statLabel: {
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: 10,
        fontWeight: "bold",
        letterSpacing: 1,
        marginBottom: 4,
    },
    statValue: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    nextStopBadge: {
        marginTop: 16,
        backgroundColor: "rgba(34, 197, 94, 0.2)",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignSelf: "flex-start",
    },
    nextStopLabel: {
        color: "#6ee7b7", // Light green
        fontWeight: "bold",
        fontSize: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginTop: 12,
        marginBottom: 20,
    },
    timelineContainer: {
        paddingLeft: 4,
        marginBottom: 40,
    },
    timelineItem: {
        flexDirection: "row",
        minHeight: 80,
    },
    timelineLeft: {
        width: 30,
        alignItems: "center",
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        zIndex: 1,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: "#EEE",
        marginVertical: 4,
    },
    timelineRight: {
        flex: 1,
        paddingLeft: 16,
        paddingBottom: 24,
        justifyContent: "center",
    },
    stopInfo: {
        flexDirection: "column",
    },
    stopName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
    },
    activeStopText: {
        color: "#22c55e",
        fontSize: 18,
    },
    stopNumber: {
        fontSize: 12,
        color: "#999",
        marginTop: 4,
    },
    tripTimingSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.2)",
    },
    timingRow: {
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
    },
    timingItem: {
        flex: 1,
    },
    timingLabel: {
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: 10,
        fontWeight: "bold",
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    timingValue: {
        color: "#FFF",
        fontSize: 14,
        fontWeight: "bold",
    },
    statusBadge: {
        backgroundColor: "rgba(107, 114, 128, 0.3)",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    statusActive: {
        backgroundColor: "rgba(34, 197, 94, 0.3)",
    },
    statusText: {
        color: "#FFF",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 0.5,
    },
    activeTripIndicator: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
        backgroundColor: "rgba(34, 197, 94, 0.15)",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 8,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#22c55e",
    },
    activeTripText: {
        color: "#6ee7b7",
        fontSize: 12,
        fontWeight: "600",
    },
});
