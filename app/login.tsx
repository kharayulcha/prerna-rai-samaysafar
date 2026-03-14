import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";

export default function LoginScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing details", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      if (!baseUrl) {
        throw new Error(
          "API base URL is not set. Please define EXPO_PUBLIC_API_BASE_URL in your .env file.",
        );
      }

      const res = await fetch(`${baseUrl}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Login failed");
      }

      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // ignore parse error, we'll still navigate but no token stored
      }

      const token = data?.token ?? data?.accessToken ?? data?.jwt;
      if (token) {
        await AsyncStorage.setItem("authToken", token);
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("authToken", token);
        }

        // Store routeId and busId from the response body (they aren't in the JWT)
        if (data?.user) {
          const { routeId, busId } = data.user;
          if (routeId !== undefined && routeId !== null) {
            await AsyncStorage.setItem("assignedRouteId", String(routeId));
          }
          if (busId !== undefined && busId !== null) {
            await AsyncStorage.setItem("assignedBusId", String(busId));
          }
        }
      }

      router.push("/dashboard");
    } catch (err: any) {
      Alert.alert("Login failed", err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Back Button */}
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        hitSlop={8}
      >
        <MaterialIcons name="arrow-back" size={24} color={DEEP_BLUE} />
      </Pressable>

      {/* Top Logo */}
      <View style={styles.logoWrapper}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Welcome Text */}
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome back to</Text>
        <Text style={styles.brand}>
          Samay<Text style={styles.brandBlue}>Safar</Text>
        </Text>
        <Text style={styles.message}>
          Sign in to manage your buses, routes, and attendance seamlessly.
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
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <MaterialIcons
              name="lock-outline"
              size={20}
              color="rgba(22,92,156,0.8)"
              style={styles.inputIcon}
            />
            <TextInput
              placeholder="••••••••"
              secureTextEntry={!passwordVisible}
              style={styles.input}
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              onPress={() => setPasswordVisible((v) => !v)}
              hitSlop={8}
            >
              <MaterialIcons
                name={passwordVisible ? "visibility" : "visibility-off"}
                size={20}
                color="rgba(22,92,156,0.8)"
              />
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push("/forgotpassword")}
            style={styles.forgotPasswordLink}
            hitSlop={8}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.loginButton, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginText}>
            {loading ? "Logging in..." : "Login"}
          </Text>
        </Pressable>
      </View>

      {/* Bottom Quote */}
      <View style={styles.quoteWrapper}>
        <Text style={styles.quote}>
          “On time, every time — because every journey matters.”
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  logoWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 110,
    height: 110,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  welcome: {
    fontSize: 18,
    color: "rgba(0,0,0,0.6)",
    marginBottom: 4,
  },
  brand: {
    fontSize: 28,
    fontWeight: "700",
    color: DEEP_BLUE,
  },
  brandBlue: {
    color: PRIMARY_BLUE,
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
    color: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
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
  loginButton: {
    marginTop: 8,
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: DEEP_BLUE,
    fontWeight: "600",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  quoteWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  quote: {
    fontSize: 12,
    fontStyle: "italic",
    color: "rgba(0,0,0,0.55)",
    textAlign: "right",
  },
});
