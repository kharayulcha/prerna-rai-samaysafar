import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import socket from "../utils/socket";

const PRIMARY_BLUE = "#3B82F6";
const DEEP_BLUE = "#1E293B";

interface NotificationItem {
    NotificationId: number;
    Message: string;
    Type: string;
    Read: boolean;
    CreatedAt?: string;
}

export default function NotificationsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

            const res = await fetch(`${apiBaseUrl}/api/users/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.notifications) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        // Listen for real-time notifications
        socket.on("notification", (newNotif) => {
            setNotifications(prev => [{
                NotificationId: Date.now(), // Temp ID
                Message: newNotif.message,
                Type: newNotif.type,
                Read: false,
            }, ...prev]);
        });

        return () => {
            socket.off("notification");
        };
    }, [fetchNotifications]);

    const getIcon = (type: string) => {
        switch (type) {
            case "trip_started": return "play-circle";
            case "trip_ended": return "stop-circle";
            default: return "notifications";
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={PRIMARY_BLUE} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.NotificationId.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[styles.card, !item.Read && styles.unreadCard]}>
                            <View style={[styles.iconContainer, { backgroundColor: item.Type === 'trip_started' ? '#E0F2FE' : '#F1F5F9' }]}>
                                <Ionicons name={getIcon(item.Type)} size={24} color={PRIMARY_BLUE} />
                            </View>
                            <View style={styles.content}>
                                <Text style={styles.message}>{item.Message}</Text>
                                <Text style={styles.time}>Just now</Text>
                            </View>
                            {!item.Read && <View style={styles.dot} />}
                        </View>
                    )}
                />
            )}
            <Navigation />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    headerTitle: { fontSize: 18, fontWeight: "bold", color: DEEP_BLUE },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 16, paddingBottom: 100 },
    empty: { flex: 1, alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, color: "#64748B", fontSize: 16 },
    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    unreadCard: { borderLeftWidth: 4, borderLeftColor: PRIMARY_BLUE },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    content: { flex: 1 },
    message: { fontSize: 14, color: DEEP_BLUE, fontWeight: "500", lineHeight: 20 },
    time: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_BLUE },
});
