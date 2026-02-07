import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Navigation from "../components/navigation";

const DEEP_BLUE = "#165C9C";

export default function MapScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={DEEP_BLUE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Live Map</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.mapPlaceholder}>
                    <Ionicons name="map-outline" size={100} color="#CCC" />
                    <Text style={styles.placeholderText}>Map Integration Coming Soon</Text>
                    <Text style={styles.subText}>You will be able to track your bus in real-time here.</Text>
                </View>
            </View>

            <Navigation />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#EEE",
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    mapPlaceholder: {
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 40,
        borderRadius: 20,
        width: "100%",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    placeholderText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#444",
        marginTop: 20,
    },
    subText: {
        fontSize: 14,
        color: "#888",
        textAlign: "center",
        marginTop: 10,
    },
});
