import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#1D4ED8";

export default function BillingScreen() {
    const router = useRouter();

    const billingData = {
        balance: "2,500",
        dueDate: "Feb 28, 2026",
        history: [
            { id: 1, title: "Monthly Subscription - Feb", date: "Feb 01, 2026", amount: "2,500", status: "Paid" },
            { id: 2, title: "Monthly Subscription - Jan", date: "Jan 01, 2026", amount: "2,500", status: "Paid" },
            { id: 3, title: "Late Fee - Dec", date: "Dec 15, 2025", amount: "200", status: "Paid" },
            { id: 4, title: "Monthly Subscription - Dec", date: "Dec 01, 2025", amount: "2,500", status: "Paid" },
        ]
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={PRIMARY_BLUE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Billing History</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Outstanding Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Outstanding Balance</Text>
                    <Text style={styles.balanceValue}>Rs. {billingData.balance}</Text>
                    <View style={styles.dueContainer}>
                        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.dueText}>Due on {billingData.dueDate}</Text>
                    </View>
                    <TouchableOpacity style={styles.payNowBtn}>
                        <Text style={styles.payNowBtnText}>Pay Now</Text>
                        <Ionicons name="arrow-forward" size={18} color={PRIMARY_BLUE} />
                    </TouchableOpacity>
                </View>

                {/* Transaction History List */}
                <Text style={styles.sectionTitle}>Transaction History</Text>
                <View style={styles.historyList}>
                    {billingData.history.map((item) => (
                        <View key={item.id} style={styles.historyItem}>
                            <View style={styles.historyIcon}>
                                <Ionicons name="receipt-outline" size={24} color="#1D4ED8" />
                            </View>
                            <View style={styles.historyDetails}>
                                <Text style={styles.historyTitle}>{item.title}</Text>
                                <Text style={styles.historyDate}>{item.date}</Text>
                            </View>
                            <View style={styles.historyAmountContainer}>
                                <Text style={styles.historyAmount}>- Rs. {item.amount}</Text>
                                <View style={styles.statusBadge}>
                                    <View style={styles.statusDot} />
                                    <Text style={styles.statusText}>{item.status}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

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
        elevation: 2,
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
        padding: 20,
    },
    balanceCard: {
        backgroundColor: PRIMARY_BLUE,
        borderRadius: 24,
        padding: 24,
        alignItems: "center",
        elevation: 8,
        shadowColor: PRIMARY_BLUE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    balanceLabel: {
        color: "rgba(255, 255, 255, 0.8)",
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
    },
    balanceValue: {
        color: "#FFF",
        fontSize: 36,
        fontWeight: "900",
        letterSpacing: -1,
    },
    dueContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        marginTop: 12,
        gap: 6,
    },
    dueText: {
        color: "#FFF",
        fontSize: 12,
        fontWeight: "600",
    },
    payNowBtn: {
        backgroundColor: "#FFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
        marginTop: 24,
        gap: 8,
        width: "100%",
    },
    payNowBtnText: {
        color: PRIMARY_BLUE,
        fontSize: 16,
        fontWeight: "bold",
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1F2937",
        marginTop: 32,
        marginBottom: 20,
    },
    historyList: {
        gap: 12,
        marginBottom: 40,
    },
    historyItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 20,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    historyIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: "#EFF6FF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    historyDetails: {
        flex: 1,
    },
    historyTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1F2937",
    },
    historyDate: {
        fontSize: 12,
        color: "#6B7280",
        marginTop: 2,
    },
    historyAmountContainer: {
        alignItems: "flex-end",
    },
    historyAmount: {
        fontSize: 15,
        fontWeight: "800",
        color: "#EF4444",
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ECFDF5",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
        gap: 4,
    },
    statusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#10B981",
    },
    statusText: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#059669",
    }
});
