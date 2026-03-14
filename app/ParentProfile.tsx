import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ParentProfile() {
  const router = useRouter();

  const onLogout = async () => {
    // Add your logout logic here (e.g., clear tokens, reset state)
    router.replace("/login"); // Change route if your login screen is different
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>Max Willim</Text>

        <Text style={styles.label}>Child</Text>
        <Text style={styles.value}>Hero</Text>

        <Text style={styles.label}>Primary Route</Text>
        <Text style={styles.value}>Dharan</Text>

        <Text style={styles.label}>Bus</Text>
        <Text style={styles.value}>N/A</Text>

        <Text style={styles.label}>Driver</Text>
        <Text style={styles.value}>Ram Bahadur</Text>

        <Text style={styles.label}>Contact</Text>
        <Text style={styles.value}>9845213278</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    padding: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  value: {
    fontSize: 20,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: "auto",
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
