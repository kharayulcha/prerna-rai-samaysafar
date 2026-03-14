import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Navigation from "../components/navigation";
import socket, { connectSocket, disconnectSocket } from "../utils/socket";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.1.73:8004";

const PRIMARY = "#1D4ED8";
const SUCCESS = "#22C55E";
const SUCCESS_LIGHT = "#F0FDF4";
const NEUTRAL = "#94A3B8";
const NEUTRAL_LIGHT = "#F8FAFC";
const TEXT_DARK = "#0F172A";
const TEXT_MID = "#475569";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#E2E8F0";
const SURFACE = "#FFFFFF";
const ERROR = "#EF4444";
const ERROR_LIGHT = "#FEF2F2";

interface FleetMember {
    BusId: number;
    BusNumber: string;
    Model: string;
    Status: "active" | "idle";
    DriverName: string;
    DriverPhone: string;
    RouteName: string;
    ActiveTrip?: {
        TripId: number;
        RouteId: number;
        RouteName: string;
        StartTime: string;
        DriverName: string;
        DriverPhone: string;
    } | null;
}

function secondsAgo(date: Date): string {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

export default function FleetDashboard() {
    const router = useRouter();
    const [fleet, setFleet] = useState<FleetMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [, setTick] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ── Pulse animation for live dot ────────────────────────────────────────
    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.25, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [pulseAnim]);

    // ── Tick every second for live "X ago" counter ───────────────────────────
    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Core fetch ───────────────────────────────────────────────────────────
    const fetchFleetStatus = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const rawToken = await AsyncStorage.getItem("authToken");
            const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;

            // Using the standard get-buses endpoint which we know exists
            const res = await fetch(`${API_BASE_URL}/api/buses/get-buses`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                // Map the results to matching FleetMember interface
                const buses = (data.buses ?? []).map((bus: any) => ({
                    BusId: bus.BusId,
                    BusNumber: bus.BusNumber,
                    Model: bus.Model,
                    Status: bus.Status || "idle",
                    DriverName: bus.DriverName || "Unassigned",
                    DriverPhone: bus.DriverPhone || "",
                    RouteName: bus.RouteName || "No Route",
                    ActiveTrip: bus.ActiveTrip || null,
                }));
                setFleet(buses);
                setLastUpdated(new Date());
                setFetchError(null);
            }
        } catch {
            // Silently handle network errors
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // ── 30-second poll ───────────────────────────────────────────────────────
    useEffect(() => {
        fetchFleetStatus();
        const interval = setInterval(() => fetchFleetStatus(false), 30000);
        return () => clearInterval(interval);
    }, [fetchFleetStatus]);

    // ── Socket.IO — instant updates on trip start/end ────────────────────────
    useEffect(() => {
        connectSocket();

        const handleNotification = (notif: { type: string }) => {
            if (notif.type === "trip_started" || notif.type === "trip_ended") {
                // Re-fetch immediately when any trip event fires
                fetchFleetStatus(false);
            }
        };

        socket.on("notification", handleNotification);

        return () => {
            socket.off("notification", handleNotification);
            disconnectSocket();
        };
    }, [fetchFleetStatus]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFleetStatus(false);
    };

    const { activeCount, idleCount } = useMemo(() => ({
        activeCount: fleet.filter((b) => b.Status === "active").length,
        idleCount: fleet.filter((b) => b.Status === "idle").length,
    }), [fleet]);

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingWrapper}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                    <Text style={styles.loadingText}>Fetching live fleet data…</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Main UI ──────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Fleet Dashboard</Text>
                    <View style={styles.liveRow}>
                        <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                        <Text style={styles.liveLabel}>Real-time Monitoring</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => fetchFleetStatus(false)} style={styles.iconBtn}>
                    <Ionicons name="refresh-outline" size={22} color={PRIMARY} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[PRIMARY]}
                        tintColor={PRIMARY}
                    />
                }
            >
                {/* Summary Bar */}
                <LinearGradient
                    colors={["#1D4ED8", "#2563EB"]}
                    style={styles.summaryCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.summaryRow}>
                        <SummaryPill
                            label="Total Fleet"
                            value={fleet.length}
                            icon="bus-outline"
                        />
                        <View style={styles.summaryDivider} />
                        <SummaryPill
                            label="Active Trips"
                            value={activeCount}
                            icon="navigate-outline"
                            accent="#4ADE80"
                        />
                        <View style={styles.summaryDivider} />
                        <SummaryPill
                            label="Idle"
                            value={idleCount}
                            icon="pause-circle-outline"
                            accent="rgba(255,255,255,0.55)"
                        />
                    </View>
                    <Text style={styles.updateLabel}>
                        Updated {secondsAgo(lastUpdated)} · socket live
                    </Text>
                </LinearGradient>

                {/* ── Section Title ── */}
                <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Vehicle Status</Text>
                    <Text style={styles.vehicleCount}>{fleet.length} vehicle{fleet.length !== 1 ? "s" : ""}</Text>
                </View>

                {/* ── Fleet Cards ── */}
                {fleet.length === 0 ? (
                    <View style={styles.emptyWrapper}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="bus-outline" size={40} color={NEUTRAL} />
                        </View>
                        <Text style={styles.emptyTitle}>No vehicles registered</Text>
                        <Text style={styles.emptySubtitle}>
                            Add buses to your fleet to see them here.
                        </Text>
                    </View>
                ) : (
                    fleet.map((bus) => (
                        <BusCard
                            key={bus.BusId}
                            bus={bus}
                            onTrack={() => {
                                if (bus.ActiveTrip?.RouteId) {
                                    router.push({
                                        pathname: "/map",
                                        params: { routeId: bus.ActiveTrip.RouteId }
                                    });
                                } else {
                                    router.push({ pathname: "/map" });
                                }
                            }}
                        />
                    ))
                )}

                <View style={{ height: 32 }} />
            </ScrollView>

            <Navigation />
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryPill({
    label, value, icon, accent = "#FFFFFF",
}: {
    label: string; value: number; icon: any; accent?: string;
}) {
    return (
        <View style={styles.pill}>
            <Ionicons name={icon} size={16} color={accent} style={{ marginBottom: 6 }} />
            <Text style={styles.pillValue}>{value}</Text>
            <Text style={styles.pillLabel}>{label}</Text>
        </View>
    );
}

function BusCard({ bus, onTrack }: { bus: any; onTrack: () => void }) {
    const isActive = bus.Status === "active";
    return (
        <View style={[styles.card, isActive && styles.cardActive]}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
                <View style={[styles.busIconBox, { backgroundColor: isActive ? "#DBEAFE" : NEUTRAL_LIGHT }]}>
                    <Ionicons name="bus" size={22} color={isActive ? PRIMARY : NEUTRAL} />
                </View>
                <View style={styles.busNameCol}>
                    <Text style={styles.busNumber}>{bus.BusNumber}</Text>
                    <Text style={styles.busModel}>{bus.Model}</Text>
                </View>
                <StatusBadge active={isActive} />
            </View>

            <View style={styles.divider} />

            {/* Live Trip Details or Default Assignment Details */}
            <View style={styles.tripGrid}>
                <TripDetail
                    icon="map-outline"
                    label="Route"
                    value={bus.RouteName || "No Route"}
                />
                <TripDetail
                    icon="person-outline"
                    label="Driver"
                    value={bus.DriverName || "Unassigned"}
                />
                {isActive && bus.ActiveTrip ? (
                    <TripDetail
                        icon="time-outline"
                        label="Started"
                        value={new Date(bus.ActiveTrip.StartTime).toLocaleString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true
                        })}
                    />
                ) : (
                    <TripDetail
                        icon="information-circle-outline"
                        label="Status"
                        value="Parked / Idle"
                    />
                )}
                {bus.DriverPhone ? (
                    <TripDetail icon="call-outline" label="Phone" value={bus.DriverPhone} />
                ) : null}
            </View>

            {isActive ? (
                <TouchableOpacity style={styles.trackBtn} onPress={onTrack} activeOpacity={0.85}>
                    <Ionicons name="navigate" size={16} color={SURFACE} />
                    <Text style={styles.trackBtnText}>Track on Map</Text>
                    <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
            ) : (
                <View style={styles.idleHint}>
                    <Ionicons name="ellipse-outline" size={13} color={NEUTRAL} />
                    <Text style={styles.idleHintText}>No active trip currently</Text>
                </View>
            )}
        </View>
    );
}

function StatusBadge({ active }: { active: boolean }) {
    return (
        <View style={[styles.badge, active ? styles.badgeActive : styles.badgeIdle]}>
            <View style={[styles.badgeDot, { backgroundColor: active ? SUCCESS : NEUTRAL }]} />
            <Text style={[styles.badgeText, { color: active ? "#166534" : TEXT_MID }]}>
                {active ? "ACTIVE" : "IDLE"}
            </Text>
        </View>
    );
}

function TripDetail({ icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <View style={styles.tripDetailRow}>
            <Ionicons name={icon} size={14} color={PRIMARY} />
            <View>
                <Text style={styles.tripDetailLabel}>{label}</Text>
                <Text style={styles.tripDetailValue}>{value}</Text>
            </View>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F1F5F9" },

    // Loading
    loadingWrapper: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    loadingText: { fontSize: 14, color: TEXT_MID, fontWeight: "500" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: SURFACE,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    iconBtn: { padding: 6, borderRadius: 10, backgroundColor: "#F8FAFC" },
    headerCenter: { flex: 1, alignItems: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: TEXT_DARK },
    liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: SUCCESS },
    liveLabel: { fontSize: 11, color: TEXT_LIGHT, fontWeight: "500" },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 8 },

    // Error Banner
    errorBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: ERROR_LIGHT,
        borderWidth: 1,
        borderColor: "#FECACA",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 14,
    },
    errorText: { flex: 1, fontSize: 13, color: "#B91C1C", fontWeight: "500" },
    retryText: { fontSize: 13, color: ERROR, fontWeight: "700" },

    // Summary Card
    summaryCard: {
        borderRadius: 20,
        paddingVertical: 20,
        paddingHorizontal: 16,
        marginBottom: 20,
        elevation: 6,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
    summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.2)" },
    pill: { flex: 1, alignItems: "center" },
    pillValue: { fontSize: 28, fontWeight: "800", color: SURFACE, lineHeight: 32 },
    pillLabel: {
        fontSize: 10,
        color: "rgba(255,255,255,0.65)",
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        marginTop: 2,
        textAlign: "center",
    },
    updateLabel: {
        textAlign: "center",
        marginTop: 12,
        fontSize: 10,
        color: "rgba(255,255,255,0.45)",
        fontStyle: "italic",
    },

    // Section
    sectionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
    vehicleCount: { fontSize: 12, color: TEXT_LIGHT, fontWeight: "500" },

    // Bus Card
    card: {
        backgroundColor: SURFACE,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },
    cardActive: {
        borderColor: "#BFDBFE",
        shadowColor: PRIMARY,
        shadowOpacity: 0.08,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    busIconBox: {
        width: 46,
        height: 46,
        borderRadius: 13,
        justifyContent: "center",
        alignItems: "center",
    },
    busNameCol: { flex: 1 },
    busNumber: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
    busModel: { fontSize: 12, color: TEXT_LIGHT, marginTop: 1 },

    // Badge
    badge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 5,
    },
    badgeActive: { backgroundColor: SUCCESS_LIGHT },
    badgeIdle: { backgroundColor: NEUTRAL_LIGHT },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },

    // Divider
    divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 14 },

    // Trip grid
    tripGrid: { gap: 10, marginBottom: 14 },
    tripDetailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    tripDetailLabel: {
        fontSize: 10,
        color: TEXT_LIGHT,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.3,
    },
    tripDetailValue: { fontSize: 13, color: TEXT_DARK, fontWeight: "600", marginTop: 1 },

    // Track button
    trackBtn: {
        backgroundColor: PRIMARY,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
        borderRadius: 13,
    },
    trackBtnText: { color: SURFACE, fontSize: 14, fontWeight: "700" },

    // Idle hint
    idleHint: { flexDirection: "row", alignItems: "center", gap: 7 },
    idleHintText: { fontSize: 12, color: TEXT_LIGHT, fontStyle: "italic" },

    // Empty state
    emptyWrapper: { alignItems: "center", paddingVertical: 56, gap: 10 },
    emptyIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: NEUTRAL_LIGHT,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: TEXT_MID },
    emptySubtitle: {
        fontSize: 13,
        color: TEXT_LIGHT,
        textAlign: "center",
        paddingHorizontal: 32,
    },
});
