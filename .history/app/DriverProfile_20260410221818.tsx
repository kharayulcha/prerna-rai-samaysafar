import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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

interface DriverProfileData {
  name: string;
  email: string;
  role: string;
  phone: string;
  routeName?: string;
  busNumber?: string;
}

export default function DriverProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

  const decodeJWT = useCallback((token: string) => {
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
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        const userDataString = await AsyncStorage.getItem("userData");
        let freshUser: any = null;
        if (userDataString) {
          try {
            freshUser = JSON.parse(userDataString);
          } catch (e) {
            console.error(e);
          }
        }

        if (token) {
          const decoded = decodeJWT(token);
          if (decoded) {
            setProfile({
              name: freshUser?.name || decoded.name || decoded.Name || "Driver",
              email:
                freshUser?.email || decoded.email || decoded.Email || "N/A",
              role: freshUser?.role || decoded.role || decoded.Role || "Driver",
              phone:
                freshUser?.phone || decoded.phone || decoded.Phone || "N/A",
              routeName:
                freshUser?.routeName ||
                decoded.routeName ||
                decoded.RouteName ||
                "",
              busNumber:
                freshUser?.busNumber ||
                decoded.busNumber ||
                decoded.BusNumber ||
                "",
            });
            if (freshUser?.ProfileImage || freshUser?.profileImage) {
              const imageUrl = getImageUrl(
                freshUser.ProfileImage || freshUser.profileImage,
              );
              if (imageUrl) setImageUri(imageUrl);
            }
          }
        }
      } catch (error) {
        console.error("Error loading driver profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [decodeJWT]);

  const handlePickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "We need permission to access your photos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUpdatingImage(true);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const formData = new FormData();
      const filename = uri.split("/").pop() || "profile.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append("profileImage", {
        uri: uri,
        name: filename,
        type: type,
      } as any);

      // Using the same endpoint as editprofile.tsx
      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        const newImage = data.user.ProfileImage || data.user.profileImage;
        setImageUri(newImage);
        // Update local storage
        await AsyncStorage.setItem("userData", JSON.stringify(data.user));
        if (newImage && newImage.startsWith("data:")) {
          await AsyncStorage.setItem("organizationLogo", newImage);
        }
        Alert.alert("Success", "Profile image updated!");
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (error: any) {
      Alert.alert("Upload Error", error.message);
    } finally {
      setUpdatingImage(false);
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={updatingImage}
            style={styles.avatarContainer}
          >
            <View style={styles.avatarCircle}>
              {updatingImage ? (
                <ActivityIndicator color="#FFF" />
              ) : imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {profile?.name?.charAt(0).toUpperCase() || "D"}
                </Text>
              )}
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{profile?.name}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>
              {(profile?.role || "Driver").toUpperCase()}
            </Text>
          </View>
        </View>

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
            icon="map-outline"
            label="Assigned Route"
            value={profile?.routeName || "N/A"}
          />
          <InfoCard
            icon="bus-outline"
            label="Assigned Vehicle"
            value={profile?.busNumber || "N/A"}
          />
        </View>

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

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
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
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: DEEP_BLUE,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#F9FAFC",
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
