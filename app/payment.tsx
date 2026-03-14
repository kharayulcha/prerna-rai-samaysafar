import React from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";

export default function Payment() {
  const payments = [
    {
      id: "p1",
      name: "Aarav Sharma",
      amount: "Rs 2,500",
      status: "Paid",
      date: "Feb 1, 2026",
    },
    {
      id: "p2",
      name: "Maya Karki",
      amount: "Rs 2,500",
      status: "Pending",
      date: "Feb 1, 2026",
    },
    {
      id: "p3",
      name: "Niraj Thapa",
      amount: "Rs 2,500",
      status: "Paid",
      date: "Jan 31, 2026",
    },
    {
      id: "p4",
      name: "Sita Rai",
      amount: "Rs 2,500",
      status: "Overdue",
      date: "Jan 28, 2026",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment</Text>
        <Text style={styles.subtitle}>Manage payments and transactions</Text>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <Text
                style={[
                  styles.status,
                  item.status === "Paid" && styles.statusPaid,
                  item.status === "Pending" && styles.statusPending,
                  item.status === "Overdue" && styles.statusOverdue,
                ]}
              >
                {item.status}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.amount}>{item.amount}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
          </View>
        )}
      />
      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: DEEP_BLUE,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  status: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  statusPaid: {
    backgroundColor: "#E7F6EC",
    color: "#2E7D32",
  },
  statusPending: {
    backgroundColor: "#FFF4E5",
    color: "#E65100",
  },
  statusOverdue: {
    backgroundColor: "#FDECEA",
    color: "#C62828",
  },
  cardFooter: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amount: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY_BLUE,
  },
  date: {
    fontSize: 12,
    color: "#777",
  },
});
