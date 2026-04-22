import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView
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
    const [selectedNotification, setSelectedNotification] = useState<NotificationWithDelete | null>(null);
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

        // Check if user is admin and join personal room
        const setupUser = async () => {
            try {
                const token = await AsyncStorage.getItem("authToken");
                const userDataStr = await AsyncStorage.getItem("userData");
                if (token) {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        const role = (payload.role || payload.Role || payload.userRole || "").toString().toLowerCase();
                        const isAdmin = payload.isAdmin || payload.IsAdmin || role === "admin" || role === "orgadmin";
                        setIsAdmin(!!isAdmin);
                        
                        // Join user-specific room for private notifications (bills, payments)
                        const userId = payload.userId || payload.UserId || (userDataStr ? JSON.parse(userDataStr).UserId : null);
                        if (userId) {
                            console.log("Joining user room:", `user-${userId}`);
                            socket.emit("join-user", userId);
                        }
                        
                        // Also join route room if available
                        const routeId = payload.routeId || payload.RouteId || (userDataStr ? JSON.parse(userDataStr).RouteId : null);
                        if (routeId) {
                            console.log("Joining route room:", `route-${routeId}`);
                            socket.emit("join-route", routeId);
                        }
                    }
                }
            } catch (e) {
                console.error("Error setting up user notifications:", e);
            }
        };

        setupUser();

        // Listen for real-time notifications
        socket.on("notification", (newNotif) => {
            console.log("Real-time notification received:", newNotif);
            
            // Skip notice type duplicates if they come via separate mechanism
            if (newNotif.type === 'notice' && lastNotificationsRef.current.has(`notice:${newNotif.message}`)) return;
            
            setNotifications(prev => [{
                NotificationId: newNotif.notificationId || Date.now(),
                Message: newNotif.message,
                Type: newNotif.type,
                Read: false,
                CreatedAt: new Date().toISOString(),
            }, ...prev]);
            
            // Automatically mark dashboard as having unread
            AsyncStorage.setItem("hasUnreadNotifications", "true");
        });

        // Listen for read notifications - sync state
        socket.on("notificationRead", (data) => {
            console.log("Notification read sync:", data.notificationId);
            setNotifications(prev =>
                prev.map(n => n.NotificationId === data.notificationId ? { ...n, Read: true } : n)
            );
        });

        // Listen for deleted notifications - immediately remove from state
        socket.on("notificationDeleted", (data) => {

            console.log("Notification deleted sync:", data.notificationId);
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
            case "trip_started": return { name: "play-circle" as any, color: "#3B82F6", bg: "#E0F2FE" };
            case "trip_ended": return { name: "stop-circle" as any, color: "#ef4444", bg: "#FEE2E2" };
            case "notice": return { name: "megaphone" as any, color: "#D97706", bg: "#FEF3C7" };
            case "bill_generated": return { name: "receipt-outline" as any, color: "#8b5cf6", bg: "#EDE9FE" };
            case "payment_success": return { name: "checkmark-circle-outline" as any, color: "#22c55e", bg: "#DCFCE7" };
            case "gps_update": return { name: "location-outline" as any, color: "#06b6d4", bg: "#CFFAFE" };
            default: return { name: "notifications" as any, color: "#64748B", bg: "#F1F5F9" };
        }
    };


    const handleNotificationPress = async (item: NotificationWithDelete) => {
        // Open modal first for immediate feedback
        setSelectedNotification(item);
        
        // If unread, mark as read on backend
        if (!item.Read) {
            try {
                const token = await AsyncStorage.getItem("authToken");
                const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
                
                const res = await fetch(`${apiBaseUrl}/api/users/notifications/${item.NotificationId}/read`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (res.ok) {
                    // Update state locally
                    setNotifications(prev => 
                        prev.map(n => n.NotificationId === item.NotificationId ? { ...n, Read: true } : n)
                    );
                    
                    // Sync to other clients via socket ROOM emit happens on backend, 
                    // but we ensure we are in sync here.
                    console.log("Marked as read successfully");
                }
            } catch (err) {
                console.error("Error marking notification as read:", err);
            }
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
                                // Sync deletion to other clients
                                socket.emit("delete-notification", { notificationId });
                                
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

    const formatDateTime = (dateString?: string): string => {
        if (!dateString) return 'Just now';
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            let hours = date.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
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
                    renderItem={({ item }) => {
                        const iconData = getIcon(item.Type);
                        return (
                            <TouchableOpacity 
                                style={[styles.card, !item.Read && styles.unreadCard, item.isDeleting && styles.deletingCard]}
                                onPress={() => handleNotificationPress(item)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: iconData.bg }]}>
                                    <Ionicons name={iconData.name} size={24} color={iconData.color} />
                                </View>
                                <View style={styles.content}>
                                    <Text style={styles.message} numberOfLines={2}>{item.Message}</Text>
                                    <Text style={styles.time}>{formatDateTime(item.CreatedAt)}</Text>
                                </View>
                                <View style={styles.rightActions}>
                                    {!item.isDeleting && (
                                        <TouchableOpacity 
                                            onPress={() => handleDeleteNotification(item.NotificationId)}
                                            style={styles.deleteButton}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                    )}
                                    {item.isDeleting && (
                                        <ActivityIndicator size="small" color={PRIMARY_BLUE} />
                                    )}
                                    {!item.Read && <View style={styles.dot} />}
                                </View>
                            </TouchableOpacity>
                        );
                    }}


                />
            )}

            <Modal
                visible={!!selectedNotification}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSelectedNotification(null)}
            >
                <View style={styles.detailOverlay}>
                    <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                            <View style={[styles.detailIconContainer, { backgroundColor: getIcon(selectedNotification?.Type || '').bg }]}>
                                <Ionicons 
                                    name={getIcon(selectedNotification?.Type || '').name} 
                                    size={32} 
                                    color={getIcon(selectedNotification?.Type || '').color} 
                                />
                            </View>
                            <TouchableOpacity onPress={() => setSelectedNotification(null)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.detailType}>
                                {(selectedNotification?.Type || '').replace('_', ' ').toUpperCase()}
                            </Text>
                            <Text style={styles.detailMessage}>{selectedNotification?.Message}</Text>
                            <Text style={styles.detailTime}>{formatDateTime(selectedNotification?.CreatedAt)}</Text>
                        </ScrollView>

                        <TouchableOpacity 
                            style={styles.closeBtn} 
                            onPress={() => setSelectedNotification(null)}
                        >
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
    
    // Detail Modal Styles
    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    detailContent: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxHeight: '70%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    detailIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailType: {
        fontSize: 12,
        fontWeight: 'bold',
        color: PRIMARY_BLUE,
        letterSpacing: 1,
        marginBottom: 12,
    },
    detailMessage: {
        fontSize: 16,
        color: DEEP_BLUE,
        lineHeight: 24,
        marginBottom: 20,
        fontWeight: '500',
    },
    detailTime: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 20,
    },
    closeBtn: {
        backgroundColor: '#F1F5F9',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    closeBtnText: {
        color: DEEP_BLUE,
        fontWeight: 'bold',
        fontSize: 16,
    }

});
