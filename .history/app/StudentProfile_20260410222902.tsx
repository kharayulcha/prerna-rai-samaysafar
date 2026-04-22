import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { getImageUrl } from "../utils/imageUrl";

interface StudentProfileModalProps {
  visible: boolean;
  onClose: () => void;
  studentData: {
    name: string;
    email: string;
    routeName?: string;
    driverName?: string;
    busNumber?: string;
    driverPhone?: string | null;
  };
}

export default function StudentProfileModal({
  visible,
  onClose,
  studentData,
}: StudentProfileModalProps) {
  const router = useRouter();
  const [updatingImage, setUpdatingImage] = React.useState(false);
  const [imageUri, setImageUri] = React.useState<string | null>(null);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

  React.useEffect(() => {
    const loadSavedImage = async () => {
      const userDataStr = await AsyncStorage.getItem("userData");
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        if (userData.ProfileImage || userData.profileImage) {
          const imageUrl = getImageUrl(
            userData.ProfileImage || userData.profileImage,
          );
          if (imageUrl) setImageUri(imageUrl);
        }
      }
    };
    if (visible) loadSavedImage();
  }, [visible]);

  const handlePickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Need permission to access gallery.");
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
      console.error(error);
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

      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        const newImagePath = data.user.ProfileImage || data.user.profileImage;
        const imageUrl = getImageUrl(newImagePath);
        if (imageUrl) {
          setImageUri(imageUrl);
        }
        await AsyncStorage.setItem("userData", JSON.stringify(data.user));
        Alert.alert("Success", "Profile photo updated!");
      } else {
        throw new Error(data.message || "Update failed");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdatingImage(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "CANCEL",
        onPress: () => {},
        style: "cancel",
      },
      {
        text: "LOGOUT",
        onPress: async () => {
          onClose();
          await AsyncStorage.clear();
          router.replace("/login");
        },
        style: "destructive",
      },
    ]);
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 1);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="chevron-back" size={28} color="#165C9C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={updatingImage}
              style={styles.avatarContainer}
            >
              <View style={styles.avatar}>
                {updatingImage ? (
                  <ActivityIndicator color="#FFF" />
                ) : imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {getInitials(studentData.name)}
                  </Text>
                )}
              </View>
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.name}>{studentData.name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>STUDENT</Text>
            </View>
          </View>

          {/* Info Cards */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={24} color="#165C9C" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{studentData.email}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="call-outline" size={24} color="#165C9C" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoValue}>
                {studentData.driverPhone || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="bus-outline" size={24} color="#165C9C" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Route</Text>
              <Text style={styles.infoValue}>
                {studentData.routeName || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-outline" size={24} color="#165C9C" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Driver</Text>
              <Text style={styles.infoValue}>
                {studentData.driverName || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="car-outline" size={24} color="#165C9C" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Bus Number</Text>
              <Text style={styles.infoValue}>
                {studentData.busNumber || "N/A"}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Logout Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="exit-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFF",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#165C9C",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#165C9C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 8,
    shadowColor: "#165C9C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFF",
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editBadge: {
    position: "absolute",
    bottom: 15,
    right: 0,
    backgroundColor: "#165C9C",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#F9FAFC",
  },

  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#E0F0FF",
    borderRadius: 20,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#165C9C",
    letterSpacing: 0.5,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E0F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
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
  logoutButtonText: {
    color: "#FF4F4F",
    fontSize: 16,
    fontWeight: "700",
  },
});
