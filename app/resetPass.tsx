import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  useEffect(() => {
    // Load email from AsyncStorage
    const loadEmail = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem("resetEmail");
        if (storedEmail) {
          setEmail(storedEmail);
        }
      } catch (err) {
        console.error("Error loading email:", err);
      }
    };
    loadEmail();
  }, []);

  const handleResetPassword = async () => {
    if (!email || !code || !newPassword) {
      Alert.alert("Missing details", "Please fill all fields.");
      return;
    }

    if (code.length !== 6) {
      Alert.alert("Invalid code", "Please enter the 6-digit verification code.");
      return;
    }

    if (!baseUrl) {
      Alert.alert("Config error", "API base URL not found in .env");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/api/users/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          code: code,
          newPassword: newPassword,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Failed to reset password");
      }

      // Clear stored email after successful reset
      await AsyncStorage.removeItem("resetEmail");

      Alert.alert(
        "Success",
        "Your password has been reset successfully! You can now login with your new password.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/login"),
          },
        ],
        { cancelable: false }
      );

      // If for some reason the alert doesn't block (Platform specific)
      // we can also set a timeout or just wait for the user to click OK as above.
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color={DEEP_BLUE} />
        </Pressable>

        {/* Image */}
        <View style={styles.imageWrapper}>
          <Image
            source={require("../assets/images/forgotpass.png")}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the verification code sent to your email and create a new password.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="mail-outline"
                size={20}
                color="rgba(22,92,156,0.8)"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={email}
                onChangeText={setEmail}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="vpn-key"
                size={20}
                color="rgba(22,92,156,0.8)"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                style={styles.input}
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="lock-outline"
                size={20}
                color="rgba(22,92,156,0.8)"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Enter new password"
                secureTextEntry={!passwordVisible}
                style={styles.input}
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Pressable
                onPress={() => setPasswordVisible(!passwordVisible)}
                hitSlop={8}
              >
                <MaterialIcons
                  name={passwordVisible ? "visibility" : "visibility-off"}
                  size={20}
                  color="rgba(22,92,156,0.8)"
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.submitButton, loading && { opacity: 0.7 }]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Reset Password</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  imageWrapper: {
    alignItems: "center",
    marginBottom: 30,
  },
  image: {
    width: 200,
    height: 200,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: DEEP_BLUE,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    lineHeight: 20,
  },
  form: {
    marginTop: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: "rgba(0,0,0,0.7)",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: "rgba(79,163,255,0.8)",
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  inputIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

