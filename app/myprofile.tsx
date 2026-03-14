import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const DEEP_BLUE = "#165C9C";
const LIGHT_BLUE = "#E0F0FF";
const ACCENT_BLUE = "#4FA3FF";

interface ProfileData {
    name: string;
    email: string;
    role: string;
    phone: string;
    address: string;
    orgId: string;
    children?: { name: string }[];
    driverName?: string;
    driverPhone?: string;
    busNumber?: string;
    routeName?: string;
    organizationLogo?: string;
}

export default function MyProfile() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    const decodeJWT = (token: string) => {
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
        } catch (error) {
            console.error("Error decoding JWT:", error);
            return null;
        }
    };

    const loadProfile = async () => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            const storedLogo = await AsyncStorage.getItem("organizationLogo");
            if (token) {
                const decoded = decodeJWT(token);
                if (decoded) {
                    setProfile({
                        name: decoded.name || decoded.Name || "User",
                        email: decoded.email || decoded.Email || "N/A",
                        role: decoded.role || decoded.Role || "User",
                        phone: decoded.phone || decoded.Phone || "N/A",
                        address: decoded.address || decoded.Address || "N/A",
                        orgId: decoded.orgId || decoded.OrgId || "N/A",
                        children: decoded.children || [],
                        driverName: decoded.driverName || null,
                        driverPhone: decoded.driverPhone || null,
                        busNumber: decoded.busNumber || null,
                        routeName: decoded.routeName || null,
                        organizationLogo: storedLogo || undefined,
                    });
                }
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await AsyncStorage.clear();
                    router.replace("/login");
                },
            },
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={DEEP_BLUE} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Profile Avatar Section */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarCircle}>
                        {profile?.organizationLogo ? (
                            <Image
                                source={{ uri: profile.organizationLogo }}
                                style={styles.avatarImage}
                                resizeMode="contain"
                            />
                        ) : (
                            <Text style={styles.avatarInitial}>
                                {profile?.name?.charAt(0).toUpperCase() || "U"}
                            </Text>
                        )}
                    </View>
                    <Text style={styles.userName}>{profile?.name}</Text>
                    <View style={styles.roleTag}>
                        <Text style={styles.roleText}>{profile?.role?.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.infoContainer}>
                    <InfoCard
                        icon="mail-outline"
                        label="Email Address"
                        value={profile?.email || "N/A"}
                    />
                    <InfoCard
                        icon="call-outline"
                        label="Phone Number"
                        value={profile?.phone || "N/A"}
                    />
                    {profile?.role?.toLowerCase() === "parent" && profile?.children && profile.children.length > 0 ? (
                        <InfoCard
                            icon="people-outline"
                            label="Children"
                            value={profile.children.map(c => c.name).join(", ")}
                        />
                    ) : (
                        <InfoCard
                            icon="location-outline"
                            label="Address"
                            value={profile?.address || "N/A"}
                        />
                    )}
                    {profile?.routeName && (
                        <InfoCard
                            icon="map-outline"
                            label="Assigned Route"
                            value={profile.routeName}
                        />
                    )}
                    {profile?.busNumber && (
                        <InfoCard
                            icon="bus-outline"
                            label="Assigned Bus"
                            value={profile.busNumber}
                        />
                    )}
                    {profile?.driverName && (
                        <InfoCard
                            icon="person-outline"
                            label="Driver"
                            value={profile.driverName}
                        />
                    )}
                    {profile?.driverPhone && (
                        <InfoCard
                            icon="call-outline"
                            label="Driver Contact"
                            value={profile.driverPhone}
                        />
                    )}
                </View>

                {/* Additional Actions */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={20} color="#FF4F4F" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function InfoCard({ icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <View style={styles.infoCard}>
            <View style={styles.infoIconBg}>
                <Ionicons name={icon} size={20} color={DEEP_BLUE} />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFC",
    },
    centerContent: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E0E0E0",
    },
    backButton: {
        padding: 8,
        borderRadius: 99,
        backgroundColor: LIGHT_BLUE,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: DEEP_BLUE,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    avatarSection: {
        alignItems: "center",
        marginTop: 30,
        marginBottom: 20,
    },
    avatarCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: DEEP_BLUE,
        justifyContent: "center",
        alignItems: "center",
        elevation: 8,
        shadowColor: DEEP_BLUE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    avatarInitial: {
        fontSize: 40,
        color: "#FFF",
        fontWeight: "bold",
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    userName: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        marginTop: 15,
    },
    roleTag: {
        backgroundColor: LIGHT_BLUE,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 99,
        marginTop: 8,
    },
    roleText: {
        fontSize: 12,
        fontWeight: "bold",
        color: DEEP_BLUE,
        letterSpacing: 1,
    },
    infoContainer: {
        paddingHorizontal: 20,
        marginTop: 10,
    },
    infoCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    infoIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: LIGHT_BLUE,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: "#888",
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 16,
        color: "#333",
        fontWeight: "600",
    },
    actionsContainer: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FFE0E0",
        gap: 8,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#FF4F4F",
    },
});
