import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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

export default function RegistrationScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");

  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  // 1. Handle Logo Selection
  const handlePickLogo = async () => {
    if (picking) return;
    try {
      setPicking(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLogoUri(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  };

  // 2. Handle Initial Registration (Multi-part Form Data)
  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !address) {
      Alert.alert("Missing details", "Please fill all fields.");
      return;
    }

    if (!baseUrl) {
      Alert.alert("Config error", "API base URL not found in .env");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("password", password);
      formData.append("address", address);

      if (logoUri) {
        formData.append("logo", {
          uri: logoUri,
          name: "logo.jpg",
          type: "image/jpeg",
        } as any);
      }

      const res = await fetch(`${baseUrl}/api/users/organization/register`, {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || "Registration failed");

      setShowOtp(true); // Open the OTP Modal
    } catch (err: any) {
      Alert.alert("Registration failed", err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Handle OTP Verification (JSON API)
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert("Invalid code", "Please enter the 6-digit code.");
      return;
    }

    try {
      setVerifying(true);
      const res = await fetch(`${baseUrl}/api/users/organization/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          code: otp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid OTP code");
      }

      Alert.alert("Success", "Account verified successfully!");
      setShowOtp(false);
      router.push("/login");
    } catch (err: any) {
      Alert.alert("Verification Error", err.message);
    } finally {
      setVerifying(false);
    }
  };

  // 4. Handle Resend OTP (JSON API)
  const handleResendOtp = async () => {
    try {
      setResending(true);
      const res = await fetch(`${baseUrl}/api/users/organization/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });

      if (!res.ok) throw new Error("Failed to resend OTP");

      Alert.alert("OTP Sent", "A new code has been sent to your email.");
      setOtp("");
    } catch (err: any) {
      Alert.alert("Resend Failed", err.message);
    } finally {
      setResending(false);
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
        {/* Top Logo / Upload */}
        <View style={styles.logoWrapper}>
          <Pressable onPress={handlePickLogo} style={styles.logoPicker}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <MaterialIcons name="add-a-photo" size={26} color="rgba(22,92,156,0.85)" />
                <Text style={styles.logoPlaceholderText}>Upload logo</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcome}>Register your organization</Text>
          <Text style={styles.brand}>
            with <Text style={styles.brandBlue}>SamaySafar</Text>
          </Text>
          <Text style={styles.message}>
            Create an account to manage routes, buses, and daily operations in one place.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Organization name</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="apartment" size={20} color="rgba(22,92,156,0.8)" style={styles.inputIcon} />
              <TextInput
                placeholder="e.g. Bright Future School"
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="mail-outline" size={20} color="rgba(22,92,156,0.8)" style={styles.inputIcon} />
              <TextInput
                placeholder="contact@school.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="phone-in-talk" size={20} color="rgba(22,92,156,0.8)" style={styles.inputIcon} />
              <TextInput
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="lock-outline" size={20} color="rgba(22,92,156,0.8)" style={styles.inputIcon} />
              <TextInput
                placeholder="Create a password"
                secureTextEntry={!passwordVisible}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setPasswordVisible(!passwordVisible)} hitSlop={8}>
                <MaterialIcons name={passwordVisible ? "visibility" : "visibility-off"} size={20} color="rgba(22,92,156,0.8)" />
              </Pressable>
            </View>
          </View>

          {/* Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Address</Text>
            <View style={[styles.inputRow, styles.addressRow]}>
              <MaterialIcons name="location-on" size={20} color="rgba(22,92,156,0.8)" style={styles.inputIcon} />
              <TextInput
                placeholder="Street, city, state, pincode"
                style={[styles.input, styles.addressInput]}
                multiline
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          {/* Register Button */}
          <Pressable
            style={[styles.registerButton, submitting && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerText}>Register organization</Text>}
          </Pressable>

          {/* --- RESTORED: ALREADY REGISTERED SECTION --- */}
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already registered?</Text>
            <Pressable
              onPress={() => router.push("/login")}
              hitSlop={8}
            >
              <Text style={styles.loginLink}> Login now</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* OTP Verification Modal */}
      <Modal visible={showOtp} transparent animationType="fade">
        <View style={styles.otpOverlay}>
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Verify OTP</Text>
            <Text style={styles.otpSubtitle}>
              Enter the 6-digit code sent to {email}
            </Text>

            <TextInput
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              keyboardType="number-pad"
              style={styles.otpInput}
              placeholder="••••••"
              placeholderTextColor="rgba(0,0,0,0.25)"
            />

            <Pressable
              style={[
                styles.verifyButton,
                (otp.length !== 6 || verifying) && styles.verifyButtonDisabled,
              ]}
              disabled={otp.length !== 6 || verifying}
              onPress={handleVerifyOtp}
            >
              {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>Verify & Continue</Text>}
            </Pressable>

            <Pressable onPress={handleResendOtp} disabled={resending}>
              <Text style={[styles.resendText, resending && { opacity: 0.5 }]}>
                {resending ? "Sending..." : "Resend OTP"}
              </Text>
            </Pressable>

            <Pressable onPress={() => setShowOtp(false)} style={{ marginTop: 15 }}>
              <Text style={{ textAlign: 'center', color: 'gray', fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 32 },
  logoWrapper: { alignItems: "center", marginBottom: 20 },
  logoPicker: { width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderColor: "rgba(79,163,255,0.9)", justifyContent: "center", alignItems: "center", backgroundColor: "#F5F9FF", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  logoPlaceholder: { justifyContent: "center", alignItems: "center", gap: 6 },
  logoPlaceholderText: { fontSize: 12, color: "rgba(0,0,0,0.6)" },
  header: { alignItems: "center", marginBottom: 24 },
  welcome: { fontSize: 18, color: "rgba(0,0,0,0.65)", marginBottom: 4 },
  brand: { fontSize: 24, fontWeight: "700", color: DEEP_BLUE },
  brandBlue: { color: PRIMARY_BLUE },
  message: { marginTop: 10, fontSize: 14, textAlign: "center", color: "rgba(0,0,0,0.6)", paddingHorizontal: 18 },
  form: { marginTop: 16 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: "rgba(0,0,0,0.7)", marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.3, borderColor: "rgba(79,163,255,0.8)", paddingHorizontal: 10, backgroundColor: "#FFFFFF" },
  inputIcon: { marginRight: 6 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14 },
  addressRow: { alignItems: "flex-start", paddingVertical: 10 },
  addressInput: { minHeight: 60, textAlignVertical: "top" },
  registerButton: { marginTop: 12, backgroundColor: PRIMARY_BLUE, paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  registerText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  loginRow: { marginTop: 15, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginPrompt: { fontSize: 13, color: "rgba(0,0,0,0.65)" },
  loginLink: { fontSize: 13, color: DEEP_BLUE, fontWeight: "600" },

  otpOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  otpCard: { width: "100%", borderRadius: 18, backgroundColor: "#FFFFFF", paddingVertical: 24, paddingHorizontal: 20, elevation: 5 },
  otpTitle: { fontSize: 20, fontWeight: "700", color: DEEP_BLUE, marginBottom: 6, textAlign: "center" },
  otpSubtitle: { fontSize: 13, color: "rgba(0,0,0,0.65)", textAlign: "center", marginBottom: 18 },
  otpInput: { alignSelf: "center", letterSpacing: 8, fontSize: 20, borderBottomWidth: 1.5, borderColor: PRIMARY_BLUE, paddingVertical: 6, textAlign: "center", minWidth: 140, marginBottom: 18 },
  verifyButton: { backgroundColor: PRIMARY_BLUE, paddingVertical: 12, borderRadius: 999, alignItems: "center", marginBottom: 10 },
  verifyButtonDisabled: { backgroundColor: "rgba(79,163,255,0.4)" },
  verifyText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  resendText: { fontSize: 13, color: DEEP_BLUE, textAlign: "center", textDecorationLine: "underline" },
});