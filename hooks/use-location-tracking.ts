import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform } from "react-native";
import { connectSocket, disconnectSocket, emitLocationUpdate } from "../utils/socket";

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.1.73:8004";

// Send location every 5 seconds
const LOCATION_INTERVAL = 5000;

interface TrackingConfig {
    tripId: number;
    routeId: number;
    driverId: number;
    token: string;
}

export function useLocationTracking() {
    const [isTracking, setIsTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const configRef = useRef<TrackingConfig | null>(null);

    // Request location permissions
    const requestPermissions = async (): Promise<boolean> => {
        try {
            const { status: foreground } =
                await Location.requestForegroundPermissionsAsync();
            if (foreground !== "granted") {
                Alert.alert(
                    "Permission Denied",
                    "Location permission is required to track the bus. Please enable it in settings."
                );
                return false;
            }

            // Request background permissions on mobile for when app is minimized
            if (Platform.OS !== "web") {
                const { status: background } =
                    await Location.requestBackgroundPermissionsAsync();
                if (background !== "granted") {
                    console.warn("Background location not granted — tracking only in foreground");
                }
            }
            return true;
        } catch (err) {
            console.error("Error requesting location permissions:", err);
            return false;
        }
    };

    // Send location to server via both REST and Socket.IO
    const sendLocation = useCallback(
        async (latitude: number, longitude: number) => {
            const config = configRef.current;
            if (!config) return;

            setCurrentLocation({ latitude, longitude });

            // Send via Socket.IO (fast, real-time)
            emitLocationUpdate({
                tripId: config.tripId,
                routeId: config.routeId,
                latitude,
                longitude,
                driverId: config.driverId,
            });

            // Also persist via REST API (for history)
            try {
                await fetch(`${API_BASE_URL}/api/trips/location`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.token}`,
                    },
                    body: JSON.stringify({
                        tripId: config.tripId,
                        latitude,
                        longitude,
                    }),
                });
            } catch (err) {
                console.warn("Failed to persist location via REST:", err);
            }
        },
        []
    );

    // Start tracking
    const startTracking = useCallback(
        async (config: TrackingConfig) => {
            const hasPermission = await requestPermissions();
            if (!hasPermission) {
                setError("Location permission not granted");
                return false;
            }

            configRef.current = config;

            // Connect socket and join route room
            connectSocket(config.routeId);

            // Start watching location
            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: LOCATION_INTERVAL,
                    distanceInterval: 10, // minimum 10 meters between updates
                },
                (location) => {
                    sendLocation(location.coords.latitude, location.coords.longitude);
                }
            );

            setIsTracking(true);
            setError(null);
            return true;
        },
        [sendLocation]
    );

    // Stop tracking
    const stopTracking = useCallback(() => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        configRef.current = null;
        setIsTracking(false);
        setCurrentLocation(null);
        disconnectSocket();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, []);

    // Handle app state changes (pause/resume tracking)
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active" && configRef.current && !locationSubscription.current) {
                // Re-start tracking when app comes to foreground
                startTracking(configRef.current);
            }
        });
        return () => subscription.remove();
    }, [startTracking]);

    return {
        isTracking,
        currentLocation,
        error,
        startTracking,
        stopTracking,
    };
}
