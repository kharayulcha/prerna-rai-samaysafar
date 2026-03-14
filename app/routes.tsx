import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#1D4ED8";

export default function RoutesScreen() {
    const router = useRouter();

    const routeDetails = {
        name: "Route 402 - North Station to Campus",
        bus: "BA 2 KA 4567",
        totalStops: 5,
        estimatedTime: "45 mins",
        stops: [
            { id: 1, name: "North Station", time: "07:30 AM", status: "completed" },
            { id: 2, name: "Baneshwor", time: "07:45 AM", status: "current" },
            { id: 3, name: "Old Baneshwor", time: "07:55 AM", status: "pending" },
            { id: 4, name: "Maiti Ghar", time: "08:10 AM", status: "pending" },
            { id: 5, name: "Campus Gate", time: "08:20 AM", status: "pending" },
        ]
    };

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
                <View style={styles.routeCard}>
                    <View style={styles.routeHeader}>
                        <View style={styles.busIconContainer}>
                            <Ionicons name="bus" size={24} color="#FFF" />
                        </View>
                        <View>
                            <Text style={styles.routeName}>{routeDetails.name}</Text>
                            <Text style={styles.busNumber}>{routeDetails.bus}</Text>
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
                </View>

                {/* Stop Timeline */}
                <Text style={styles.sectionTitle}>Stop Timeline</Text>
                <View style={styles.timelineContainer}>
                    {routeDetails.stops.map((stop, index) => (
                        <View key={stop.id} style={styles.timelineItem}>
                            <View style={styles.timelineLeft}>
                                <View style={[
                                    styles.timelineDot,
                                    stop.status === 'completed' && styles.dotCompleted,
                                    stop.status === 'current' && styles.dotCurrent,
                                ]} />
                                {index !== routeDetails.stops.length - 1 && <View style={styles.timelineLine} />}
                            </View>
                            <View style={styles.timelineRight}>
                                <View style={styles.stopInfo}>
                                    <Text style={[
                                        styles.stopName,
                                        stop.status === 'completed' && styles.textMuted
                                    ]}>{stop.name}</Text>
                                    <Text style={styles.stopTime}>{stop.time}</Text>
                                </View>
                                {stop.status === 'current' && (
                                    <View style={styles.currentBadge}>
                                        <Text style={styles.currentBadgeText}>Current Stop</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginTop: 32,
        marginBottom: 20,
    },
    timelineContainer: {
        paddingLeft: 4,
    },
    timelineItem: {
        flexDirection: "row",
        height: 80,
    },
    timelineLeft: {
        width: 30,
        alignItems: "center",
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#DDD",
        zIndex: 1,
    },
    dotCompleted: {
        backgroundColor: "#3B82F6",
    },
    dotCurrent: {
        backgroundColor: "#38BDF8",
        borderWidth: 3,
        borderColor: "rgba(56, 189, 248, 0.3)",
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
    },
    stopInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    stopName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
    },
    stopTime: {
        fontSize: 14,
        color: "#64748B",
    },
    textMuted: {
        color: "#94A3B8",
    },
    currentBadge: {
        marginTop: 4,
        backgroundColor: "rgba(56, 189, 248, 0.1)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: "flex-start",
    },
    currentBadgeText: {
        color: "#0284C7",
        fontSize: 10,
        fontWeight: "bold",
    }
});
