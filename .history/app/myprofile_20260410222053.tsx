import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { getImageUrl } from "../utils/imageUrl";

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
    driverName?: string;
    driverPhone?: string;
    busNumber?: string;
    routeName?: string;
    profileImage?: string | null;
}

export default function MyProfile() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [])
    );

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
            let freshUser: any = null;

            if (token) {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        freshUser = data.user;
                        await AsyncStorage.setItem("userData", JSON.stringify(freshUser));
                    }
                } catch (e) {
                    console.log("[MyProfile] Remote profile fetch failed:", e);
                }

                const decoded = decodeJWT(token);
                if (decoded || freshUser) {
                    setProfile({
                        name: freshUser?.name || decoded?.name || decoded?.Name || "User",
                        email: freshUser?.email || decoded?.email || decoded?.Email || "N/A",
                        role: (freshUser?.role || decoded?.role || decoded?.Role || "User").toLowerCase(),
                        phone: freshUser?.phone || decoded?.phone || decoded?.Phone || "N/A",
                        address: freshUser?.address || decoded?.address || decoded?.Address || "N/A",
                        orgId: freshUser?.orgId || decoded?.orgId || decoded?.OrgId || "N/A",
                        driverName: freshUser?.driverName || decoded?.driverName || null,
                        driverPhone: freshUser?.driverPhone || decoded?.driverPhone || null,
                        busNumber: freshUser?.busNumber || decoded?.busNumber || null,
                        routeName: freshUser?.routeName || decoded?.routeName || null,
                        profileImage: freshUser?.profileImage || decoded?.profileImage || null,
                    });
                }
            }

            const userData = await AsyncStorage.getItem("userData");
            if (userData) {
                const parsed = JSON.parse(userData);
                const storedImage = parsed.ProfileImage || parsed.profileImage;
                if (storedImage) {
                    setProfile(prev => prev ? { ...prev, profileImage: storedImage } : null);
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
    
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permission denied", "We need permission to access your photos.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.5,
                allowsEditing: true,
                aspect: [1, 1],
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const uri = result.assets[0].uri;
                saveProfileImage(uri);
            }
        } catch (error) {
            console.error("Error picking image:", error);
        }
    };

    const saveProfileImage = async (uri: string) => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            if (!token) throw new Error("No auth token found");

            const formData = new FormData();
            const filename = uri.split('/').pop() || 'profile.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            formData.append("profileImage", {
                uri: uri,
                name: filename,
                type: type,
            } as any);

            const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                if (data.token) {
                    await AsyncStorage.setItem("authToken", data.token);
                }
                if (data.user) {
                    await AsyncStorage.setItem("userData", JSON.stringify(data.user));
                    const updatedImage = (data.user.ProfileImage || data.user.profileImage || uri);
                    
                    // Also update organizationLogo for the dashboard to pick up
                    if (updatedImage && updatedImage.startsWith('data:')) {
                        await AsyncStorage.setItem("organizationLogo", updatedImage);
                    }
                    
                    setProfile(prev => prev ? { ...prev, profileImage: updatedImage } : null);
                }
                Alert.alert("Success", "Profile image updated!");
            } else {
                throw new Error(data.message || "Failed to update profile image");
            }
        } catch (error: any) {
            Alert.alert("Update Error", error.message);
        } finally {
            setLoading(false);
        }
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
                <TouchableOpacity onPress={() => router.push("/editprofile")} style={styles.editButton}>
                    <Ionicons name="create-outline" size={24} color={DEEP_BLUE} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Profile Avatar Section */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
                        <View style={styles.avatarCircle}>
                            {profile?.profileImage ? (
                                <Image source={{ uri: profile.profileImage }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarInitial}>
                                    {profile?.name?.charAt(0).toUpperCase() || "U"}
                                </Text>
                            )}
                        </View>
                        <View style={styles.smallCameraIcon}>
                            <Ionicons name="camera" size={16} color="#FFF" />
                        </View>
                    </TouchableOpacity>
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
                    <InfoCard
                        icon="location-outline"
                        label="Address"
                        value={profile?.address || "N/A"}
                    />
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
    editButton: {
        padding: 8,
        borderRadius: 99,
        backgroundColor: LIGHT_BLUE,
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    editProfileButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LIGHT_BLUE,
        gap: 8,
        marginBottom: 12,
    },
    editProfileText: {
        fontSize: 16,
        fontWeight: "bold",
        color: DEEP_BLUE,
    },
    avatarContainer: {
        position: 'relative',
    },
    smallCameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: ACCENT_BLUE,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
});
