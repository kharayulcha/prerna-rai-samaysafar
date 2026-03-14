import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
const RED = "#EF4444";

interface NotificationItem {
    NotificationId: number;
    Message: string;
    Type: string;
    Read: boolean;
    CreatedAt?: string;
}

interface NotificationWithDelete extends NotificationItem {
    isDeleting?: boolean;
}

export default function NotificationsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationWithDelete[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const lastNotificationsRef = useRef<Set<string>>(new Set());

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

            // Add cache-busting parameter to ensure fresh data
            const url = `${apiBaseUrl}/api/users/notifications?t=${Date.now()}`;

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });

            if (!res.ok) {
                console.error("Fetch failed with status:", res.status);
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            console.log("Fetched notifications:", data.notifications);
            console.log("Number of notifications:", data.notifications?.length);

            if (data.notifications && Array.isArray(data.notifications)) {
                setNotifications(data.notifications);
                // Track these notifications to prevent socket duplicates
                lastNotificationsRef.current = new Set(
                    data.notifications.map((n: NotificationItem) => `${n.Type}:${n.Message}`)
                );
            } else {
                console.warn("No notifications in response or not an array");
                setNotifications([]);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch immediately on mount
        fetchNotifications();

        // Check if user is admin
        const checkAdminStatus = async () => {
            try {
                const token = await AsyncStorage.getItem("authToken");
                if (token) {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        // Check for admin role using common patterns found in your backend
                        const role = (payload.role || payload.Role || payload.userRole || "").toString().toLowerCase();
                        const isAdmin = payload.isAdmin || payload.IsAdmin || role === "admin" || role === "1";
                        setIsAdmin(!!isAdmin);
                    }
                }
            } catch (e) {
                console.error("Error checking admin status:", e);
            }
        };

        checkAdminStatus();

        // Listen for real-time notifications (only for trip events, not notices)
        socket.on("notification", (newNotif) => {
            // Skip notice type - they should be fetched from API to avoid duplicates
            if (newNotif.type === 'notice') return;

            const notifKey = `${newNotif.type}:${newNotif.message}`;

            // Check if this notification was already added
            if (lastNotificationsRef.current.has(notifKey)) {
                console.warn("Duplicate notification skipped:", notifKey);
                return;
            }

            lastNotificationsRef.current.add(notifKey);

            setNotifications(prev => [{
                NotificationId: Math.max(...prev.map(n => n.NotificationId), 0) + 1,
                Message: newNotif.message,
                Type: newNotif.type,
                Read: false,
                CreatedAt: new Date().toISOString(),
            }, ...prev]);
        });

        // Listen for deleted notifications - immediately remove from state
        socket.on("notificationDeleted", (data) => {
            console.log("Notification deleted:", data.notificationId);
            setNotifications(prev =>
                prev.filter(n => n.NotificationId !== data.notificationId)
            );
        });

        // Listen for new notices - refetch when a new notice is sent
        socket.on("noticeAdded", () => {
            console.log("New notice added, refetching notifications");
            fetchNotifications();
        });

        return () => {
            socket.off("notification");
            socket.off("notificationDeleted");
            socket.off("noticeAdded");
        };
    }, [fetchNotifications]);

    // Refetch notifications when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            console.log("Screen focused, refetching notifications");
            fetchNotifications();
        }, [fetchNotifications])
    );

    const getIcon = (type: string) => {
        switch (type) {
            case "trip_started": return "play-circle";
            case "trip_ended": return "stop-circle";
            case "notice": return "megaphone";
            default: return "notifications";
        }
    };

    const handleDeleteNotification = async (notificationId: number) => {
        Alert.alert(
            "Delete Notification",
            "Are you sure you want to delete this notification?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    onPress: async () => {
                        try {
                            // Mark as deleting for UI feedback
                            setNotifications(prev =>
                                prev.map(n => n.NotificationId === notificationId
                                    ? { ...n, isDeleting: true }
                                    : n
                                )
                            );

                            const token = await AsyncStorage.getItem("authToken");
                            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

                            const res = await fetch(
                                `${apiBaseUrl}/api/users/notifications/${notificationId}`,
                                {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` }
                                }
                            );

                            if (res.ok) {
                                // Remove from state
                                setNotifications(prev =>
                                    prev.filter(n => n.NotificationId !== notificationId)
                                );
                            } else {
                                const data = await res.json();
                                Alert.alert("Error", data.message || "Failed to delete notification");
                                // Remove deleting state on error
                                setNotifications(prev =>
                                    prev.map(n => n.NotificationId === notificationId
                                        ? { ...n, isDeleting: false }
                                        : n
                                    )
                                );
                            }
                        } catch (error) {
                            console.error("Error deleting notification:", error);
                            Alert.alert("Error", "Failed to delete notification");
                            setNotifications(prev =>
                                prev.map(n => n.NotificationId === notificationId
                                    ? { ...n, isDeleting: false }
                                    : n
                                )
                            );
                        }
                    },
                    style: "destructive"
                }
            ]
        );
    };

    const handleMarkRead = async (notificationId: number) => {
        // Optimistic UI update - remove blue dot immediately
        setNotifications(prev =>
            prev.map(n => n.NotificationId === notificationId ? { ...n, Read: true } : n)
        );
        try {
            const token = await AsyncStorage.getItem("authToken");
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
            await fetch(
                `${apiBaseUrl}/api/users/notifications/${notificationId}/read`,
                {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const formatDateTime = (dateInput?: any): string => {
        if (!dateInput) return 'Just now';
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return 'Just now';

            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();

            const rawHours = date.getHours();
            const ampm = rawHours >= 12 ? 'PM' : 'AM';
            const hours12 = rawHours % 12 || 12; // convert 0 → 12
            const hours = hours12.toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
        } catch (e) {
            return 'Just now';
        }
    };


    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 28 }} />
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
                        <TouchableOpacity
                            onPress={() => !item.Read && handleMarkRead(item.NotificationId)}
                            activeOpacity={item.Read ? 1 : 0.7}
                            style={[styles.card, !item.Read && styles.unreadCard, item.isDeleting && styles.deletingCard]}
                        >
                            <View style={[styles.iconContainer,
                            {
                                backgroundColor:
                                    item.Type === 'trip_started' ? '#E0F2FE' :
                                        item.Type === 'notice' ? '#FEF3C7' : '#F1F5F9'
                            }]}>
                                <Ionicons name={getIcon(item.Type)} size={24} color={item.Type === 'notice' ? '#D97706' : PRIMARY_BLUE} />
                            </View>
                            <View style={styles.content}>
                                <Text style={styles.message}>{item.Message}</Text>
                                <Text style={styles.time}>{formatDateTime(item.CreatedAt || (item as any).createdAt)}</Text>
                            </View>
                            <View style={styles.rightActions}>
                                {isAdmin && !item.isDeleting && (
                                    <TouchableOpacity
                                        onPress={() => handleDeleteNotification(item.NotificationId)}
                                        style={styles.deleteButton}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={RED} />
                                    </TouchableOpacity>
                                )}
                                {item.isDeleting && (
                                    <ActivityIndicator size="small" color={PRIMARY_BLUE} />
                                )}
                                {!item.Read && !item.isDeleting && <View style={styles.dot} />}
                            </View>
                        </TouchableOpacity>
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
    deletingCard: { opacity: 0.6 },
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
    rightActions: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 12,
    },
    deleteButton: {
        padding: 8,
        marginRight: 4,
    },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_BLUE },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: DEEP_BLUE,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
        color: DEEP_BLUE,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    sendButton: {
        backgroundColor: PRIMARY_BLUE,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.6,
    },
    sendButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
