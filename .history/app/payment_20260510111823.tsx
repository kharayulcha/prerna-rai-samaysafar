import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,

} from "react-native";
import { WebView } from "react-native-webview";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";
const GREEN = "#60BB46";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;



interface BillItem {
  BillId: number;
  Amount: number;
  Status: string;
  DueDate: string;
  PeriodStart: string;
  PeriodEnd: string;
  student: { Name: string };
  route: { Name: string } | null;
  payments: any[];
  remainingAmount?: number;
}

interface PaymentItem {
  PaymentId: number;
  Amount: number;
  Status: string;
  Provider: string;
  PaidAt: string | null;
  RefId: string | null;
  bill: {
    student: { Name: string };
    route: { Name: string } | null;
  };
}

interface AdminRoute {
  RouteId: number;
  Name: string;
  _count: { students: number };
  students: {
    UserId: number;
    Name: string;
    ParentId: number | null;
    parent: { UserId: number; Name: string; Phone: string } | null;
  }[];
  bills: { BillId: number; Amount: number; Status: string; DueDate: string; StudentId: number }[];
  stops: { StopId: number; Name: string; Latitude: number; Longitude: number; SequenceOrder: number }[];
}

interface AdminBill {
  BillId: number;
  Amount: number;
  Status: string;
  DueDate: string;
  PeriodStart: string;
  PeriodEnd: string;
  student: { Name: string };
  parent: { Name: string; Phone: string };
  route: { Name: string } | null;
  payments: { PaymentId: number; Amount: number; Status: string; PaidAt: string | null; Provider: string }[];
}

//Helpers 
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const formatCurrency = (amount: number) => `Rs ${amount.toLocaleString()}`;

const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "paid":
    case "completed":
      return styles.statusPaid;
    case "pending":
      return styles.statusPending;
    case "overdue":
    case "failed":
    case "verification_failed":
      return styles.statusOverdue;
    default:
      return styles.statusPending;
  }
};

export default function Payment() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // Decode role from JWT
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          const decoded = JSON.parse(jsonPayload);
          setUserRole((decoded.role || decoded.Role || "").toLowerCase());
        }
      } catch (e) {
        console.error("Failed to decode token for role:", e);
      } finally {
        setLoadingRole(false);
      }
    })();
  }, []);

  if (loadingRole) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredLoading}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        </View>
        <Navigation />
      </SafeAreaView>
    );
  }

  const isAdmin = userRole === "admin" || userRole === "orgadmin" || userRole === "org_admin";

  return isAdmin ? <AdminPaymentView /> : <ParentPaymentView />;
}

// Admin view for payment 
function AdminPaymentView() {
  const [activeTab, setActiveTab] = useState<"routes" | "bills" | "payments">("routes");
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [adminBills, setAdminBills] = useState<AdminBill[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<AdminRoute | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [filterRouteId, setFilterRouteId] = useState<number | null>(null);

  // Form state for bill generation
  const [billAmount, setBillAmount] = useState("");
  const [billDueDate, setBillDueDate] = useState("");
  const [billPeriodStart, setBillPeriodStart] = useState("");
  const [billPeriodEnd, setBillPeriodEnd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [calculationBreakdown, setCalculationBreakdown] = useState<string>("");

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const rawToken = await AsyncStorage.getItem("authToken");
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Haversine formula to calculate distance between two coordinates (in km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate total route distance from stops
  const calculateRouteDistance = (stops: AdminRoute["stops"]): number => {
    if (!stops || stops.length < 2) return 5; // Minimum 5km if insufficient stops

    let totalDistance = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      totalDistance += calculateDistance(stops[i].Latitude, stops[i].Longitude, stops[i + 1].Latitude, stops[i + 1].Longitude);
    }
    return Math.round(totalDistance * 10) / 10; // Round to 1 decimal place
  };

  // Calculate transportation fee based on billing rules
  const calculateTransportationFee = useCallback((route: AdminRoute, startDate: string, endDate: string): void => {
    try {
      if (!startDate || !endDate) return;
      // Billing rules for each 
      const BASE_FEE = 50; // NPR
      const PRICE_PER_KM = 10// NPR per km

      // Calculate period length
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Calculate actual distance from route stops
      const routeDistance = calculateRouteDistance(route.stops);
      const distanceFee = routeDistance * PRICE_PER_KM;
      const dailyFee = BASE_FEE + distanceFee;
      const periodFee = Math.round(dailyFee * daysInPeriod);

      // Round to nearest 50
      const finalAmount = Math.round(periodFee / 50) * 50;

      // Calculate breakdown
      const breakdown = `Base: Γé╣${BASE_FEE} + Distance (${routeDistance}km ├ù Γé╣${PRICE_PER_KM} = Γé╣${distanceFee.toFixed(0)}) = Γé╣${dailyFee.toFixed(0)}/day ├ù ${daysInPeriod} days = Γé╣${periodFee}`;

      setCalculatedAmount(finalAmount);
      setCalculationBreakdown(breakdown);
      setBillAmount(finalAmount.toString());
    } catch (error) {
      console.error("Error calculating fee:", error);
      setCalculatedAmount(null);
      setCalculationBreakdown("");
    }
  }, []);

  // Fetch admin routes
  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/payments/admin/routes`, {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      setRoutes(data.routes ?? []);
    } catch (err: any) {
      console.error("Error fetching admin routes:", err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Fetch admin bills
  const fetchAdminBills = useCallback(async (routeId?: number | null) => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      let url = `${API_BASE_URL}/api/payments/admin/bills`;
      if (routeId) url += `?routeId=${routeId}`;
      const res = await fetch(url, {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      setAdminBills(data.bills ?? []);
    } catch (err: any) {
      console.error("Error fetching admin bills:", err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Fetch all payments
  const fetchAllPayments = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      console.log("[ADMIN] Fetching all payments...");
      const res = await fetch(`${API_BASE_URL}/api/payments/admin/all`, {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      console.log("[ADMIN] All payments response status:", res.status);
      const text = await res.text();
      console.log("[ADMIN] All payments raw response:", text.substring(0, 500));
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON response"); }
      if (!res.ok) throw new Error(data?.message || "Failed");
      setAllPayments(data.payments ?? []);
    } catch (err: any) {
      console.error("Error fetching all payments:", err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (activeTab === "bills") fetchAdminBills(filterRouteId);
    if (activeTab === "payments") fetchAllPayments();
  }, [activeTab, filterRouteId, fetchAdminBills, fetchAllPayments]);

  // Recalculate fee when period dates change
  useEffect(() => {
    if (selectedRoute && billPeriodStart && billPeriodEnd && showGenerateModal) {
      calculateTransportationFee(selectedRoute, billPeriodStart, billPeriodEnd);
    }
  }, [billPeriodStart, billPeriodEnd, selectedRoute, showGenerateModal, calculateTransportationFee]);

  // Generate bills
  const handleGenerateBills = async () => {
    if (!selectedRoute) return;
    if (!billAmount || !billPeriodStart || !billPeriodEnd || !billDueDate) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }

    try {
      setGenerating(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/payments/admin/generate-bills`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selectedRoute.RouteId,
          amount: Number(billAmount),
          periodStart: billPeriodStart,
          periodEnd: billPeriodEnd,
          dueDate: billDueDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to generate bills");

      Alert.alert("Success", data.message);
      setShowGenerateModal(false);
      setBillAmount("");
      setBillDueDate("");
      setBillPeriodStart("");
      setBillPeriodEnd("");
      setCalculatedAmount(null);
      setCalculationBreakdown("");
      fetchRoutes(); // refresh counts
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate bills");
    } finally {
      setGenerating(false);
    }
  };

  const openGenerateModal = (route: AdminRoute) => {
    setSelectedRoute(route);
    // Default dates: current month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${lastDay}`;
    setBillPeriodStart(startDate);
    setBillPeriodEnd(endDate);
    setBillDueDate(`${year}-${month}-${Math.min(lastDay, 28)}`);
    // Calculate fee based on route and period
    calculateTransportationFee(route, startDate, endDate);
    setShowGenerateModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Management</Text>
        <Text style={styles.subtitle}>Assign bills and track payments</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(["routes", "bills", "payments"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === "routes" ? "trail-sign" : tab === "bills" ? "document-text" : "card"}
              size={16}
              color={activeTab === tab ? PRIMARY_BLUE : "#999"}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Routes Tab */}
      {activeTab === "routes" && (
        loading ? (
          <View style={styles.centeredLoading}><ActivityIndicator size="large" color={PRIMARY_BLUE} /></View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(item) => item.RouteId.toString()}
            contentContainerStyle={styles.listContent}
            onRefresh={fetchRoutes}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="trail-sign-outline" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No Routes</Text>
                <Text style={styles.emptyText}>Create routes first to assign payments.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const studentsWithParent = item.students.filter((s) => s.ParentId);
              const pendingBills = item.bills.filter((b) => b.Status === "pending" || b.Status === "overdue");
              const paidBills = item.bills.filter((b) => b.Status === "paid");

              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.Name}</Text>
                      <Text style={styles.routeLabel}>
                        {item.students.length} student{item.students.length !== 1 ? "s" : ""}
                        {studentsWithParent.length < item.students.length &&
                          ` (${studentsWithParent.length} billable)`}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {pendingBills.length > 0 && (
                        <Text style={[styles.status, styles.statusPending]}>
                          {pendingBills.length} PENDING
                        </Text>
                      )}
                      {paidBills.length > 0 && (
                        <Text style={[styles.status, styles.statusPaid, { marginTop: 4 }]}>
                          {paidBills.length} PAID
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Student list */}
                  <View style={styles.billDetails}>
                    {item.students.slice(0, 5).map((student) => (
                      <View key={student.UserId} style={styles.studentRow}>
                        <Ionicons name="person" size={14} color="#666" />
                        <Text style={styles.studentName}>{student.Name}</Text>
                        {student.parent ? (
                          <Text style={styles.parentLabel}>({student.parent.Name})</Text>
                        ) : (
                          <Text style={[styles.parentLabel, { color: "#ef4444" }]}>(No parent)</Text>
                        )}
                      </View>
                    ))}
                    {item.students.length > 5 && (
                      <Text style={styles.moreText}>+{item.students.length - 5} more</Text>
                    )}
                  </View>

                  {/* Generate Bills Button */}
                  {studentsWithParent.length > 0 && (
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={() => openGenerateModal(item)}
                    >
                      <Ionicons name="add-circle" size={18} color="#FFF" />
                      <Text style={styles.generateButtonText}>Generate Bills for Route</Text>
                    </TouchableOpacity>
                  )}

                  {/* View Bills for Route */}
                  <TouchableOpacity
                    style={styles.viewBillsButton}
                    onPress={() => {
                      setFilterRouteId(item.RouteId);
                      setActiveTab("bills");
                    }}
                  >
                    <Ionicons name="document-text-outline" size={16} color={DEEP_BLUE} />
                    <Text style={styles.viewBillsText}>View Bills</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )
      )}

      {/* Bills Tab */}
      {activeTab === "bills" && (
        <>
          {/* Route filter */}
          {filterRouteId && (
            <View style={styles.filterBar}>
              <Text style={styles.filterText}>
                Filtered: {routes.find((r) => r.RouteId === filterRouteId)?.Name ?? `Route #${filterRouteId}`}
              </Text>
              <TouchableOpacity onPress={() => { setFilterRouteId(null); fetchAdminBills(null); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          )}
          {loading ? (
            <View style={styles.centeredLoading}><ActivityIndicator size="large" color={PRIMARY_BLUE} /></View>
          ) : (
            <FlatList
              data={adminBills}
              keyExtractor={(item) => item.BillId.toString()}
              contentContainerStyle={styles.listContent}
              onRefresh={() => fetchAdminBills(filterRouteId)}
              refreshing={loading}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyTitle}>No Bills</Text>
                  <Text style={styles.emptyText}>Generate bills from the Routes tab.</Text>
                </View>
              }
              renderItem={({ item }) => {
                const paidAmount = item.payments
                  .filter((p) => p.Status === "completed")
                  .reduce((sum, p) => sum + p.Amount, 0);

                return (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.student.Name}</Text>
                        <Text style={styles.routeLabel}>{item.route?.Name ?? "No Route"}</Text>
                        <Text style={styles.parentLabel}>Parent: {item.parent.Name}</Text>
                      </View>
                      <Text style={[styles.status, getStatusStyle(item.Status)]}>
                        {item.Status.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.billDetails}>
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Period</Text>
                        <Text style={styles.billValue}>
                          {formatDate(item.PeriodStart)} - {formatDate(item.PeriodEnd)}
                        </Text>
                      </View>
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Due</Text>
                        <Text style={[styles.billValue, new Date(item.DueDate) < new Date() && item.Status !== "paid" ? { color: "#ef4444" } : {}]}>
                          {formatDate(item.DueDate)}
                        </Text>
                      </View>
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Amount</Text>
                        <Text style={styles.billValue}>{formatCurrency(item.Amount)}</Text>
                      </View>
                      {paidAmount > 0 && (
                        <View style={styles.billRow}>
                          <Text style={styles.billLabel}>Paid</Text>
                          <Text style={[styles.billValue, { color: "#22c55e" }]}>
                            {formatCurrency(paidAmount)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        loading ? (
          <View style={styles.centeredLoading}><ActivityIndicator size="large" color={PRIMARY_BLUE} /></View>
        ) : (
          <FlatList
            data={allPayments}
            keyExtractor={(item) => item.PaymentId.toString()}
            contentContainerStyle={styles.listContent}
            onRefresh={fetchAllPayments}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="card-outline" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No Payments</Text>
                <Text style={styles.emptyText}>Payment transactions will appear here.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.bill?.student?.Name ?? "Unknown"}</Text>
                    <Text style={styles.routeLabel}>{item.bill?.route?.Name ?? ""}</Text>
                    {item.parent && (
                      <Text style={styles.parentLabel}>Paid by: {item.parent.Name}</Text>
                    )}
                  </View>
                  <Text style={[styles.status, getStatusStyle(item.Status)]}>
                    {item.Status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.amount}>{formatCurrency(item.Amount)}</Text>
                    <Text style={styles.provider}>via {item.Provider}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.date}>{item.PaidAt ? formatDate(item.PaidAt) : "Pending"}</Text>
                    {item.RefId && <Text style={styles.refId}>Ref: {item.RefId}</Text>}
                  </View>
                </View>
              </View>
            )}
          />
        )
      )}

      {/* Generate Bills Modal */}
      <Modal
        visible={showGenerateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGenerateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Bills</Text>
              <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedRoute && (
              <View style={styles.modalRouteInfo}>
                <Ionicons name="trail-sign" size={18} color={DEEP_BLUE} />
                <Text style={styles.modalRouteName}>{selectedRoute.Name}</Text>
                <Text style={styles.modalRouteCount}>
                  {selectedRoute.students.filter((s) => s.ParentId).length} students
                </Text>
              </View>
            )}

            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Amount per Student (Rs)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2500"
                keyboardType="numeric"
                value={billAmount}
                onChangeText={setBillAmount}
                placeholderTextColor="#aaa"
              />

              <Text style={styles.inputLabel}>Period Start (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-02-01"
                value={billPeriodStart}
                onChangeText={setBillPeriodStart}
                placeholderTextColor="#aaa"
              />

              <Text style={styles.inputLabel}>Period End (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-02-28"
                value={billPeriodEnd}
                onChangeText={setBillPeriodEnd}
                placeholderTextColor="#aaa"
              />

              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-02-28"
                value={billDueDate}
                onChangeText={setBillDueDate}
                placeholderTextColor="#aaa"
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.generateButton, { marginTop: 16 }, generating && { opacity: 0.6 }]}
              onPress={handleGenerateBills}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.generateButtonText}>Generate Bills</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Navigation />
    </SafeAreaView>
  );
}

// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
// PARENT VIEW
// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
function ParentPaymentView() {
  const [activeTab, setActiveTab] = useState<"bills" | "history">("bills");
  const [bills, setBills] = useState<BillItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [payingBillId, setPayingBillId] = useState<number | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<number | null>(null);
  const [showEsewaWebView, setShowEsewaWebView] = useState(false);
  const [webViewHtml, setWebViewHtml] = useState<string>("");
  const [webViewTitle, setWebViewTitle] = useState<string>("eSewa Payment");
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 4;




  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const rawToken = await AsyncStorage.getItem("authToken");
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      setLoadingBills(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/payments/bills`, {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch bills");

      const billsWithRemaining = (data.bills ?? []).map((bill: any) => {
        const paidSoFar = (bill.payments ?? [])
          .filter((p: any) => p.Status === "completed")
          .reduce((sum: number, p: any) => sum + p.Amount, 0);
        return { ...bill, remainingAmount: bill.Amount - paidSoFar };
      });
      setBills(billsWithRemaining);
    } catch (err: any) {
      console.error("Error fetching bills:", err);
    } finally {
      setLoadingBills(false);
    }
  }, [getAuthHeaders]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/payments/history`, {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch history");
      setPayments(data.payments ?? []);
    } catch (err: any) {
      console.error("Error fetching payment history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchBills();
    fetchHistory();
  }, [fetchBills, fetchHistory]);

  const handlePayBill = async (billId: number, provider: 'esewa' | 'khalti' = 'esewa') => {
    try {
      setPayingBillId(billId);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/payments/initiate`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ billId, provider }),
      });


      if (!res.ok) {
        let errMsg = "Failed to initiate payment";
        try { const errData = await res.json(); errMsg = errData.message || errMsg; } catch { }
        throw new Error(errMsg);
      }

      const data = await res.json();
      
      if (provider === 'esewa') {
        const { paymentUrl, params } = data.esewaConfig;

        const formFields = Object.entries(params)
          .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
          .join("\n");

        const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;font-family:-apple-system,sans-serif}
.spinner{width:40px;height:40px;border:4px solid #ddd;border-top-color:#60BB46;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}p{color:#666;font-size:16px}</style></head>
<body><div style="text-align:center"><div class="spinner"></div><p>Redirecting to eSewa...</p></div>
<form id="f" action="${paymentUrl}" method="POST">${formFields}</form>
<script>document.getElementById('f').submit();</script></body></html>`;

        setWebViewHtml(html);
        setWebViewTitle("eSewa Payment");
        setShowEsewaWebView(true);
      } else if (provider === 'khalti') {
        const { paymentUrl } = data.khaltiConfig;
        
        const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;font-family:-apple-system,sans-serif}
.spinner{width:40px;height:40px;border:4px solid #ddd;border-top-color:#5C2D91;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}p{color:#666;font-size:16px}</style></head>
<body><div style="text-align:center"><div class="spinner"></div><p>Redirecting to Khalti...</p></div>
<script>window.location.href = "${paymentUrl}";</script></body></html>`;

        setWebViewHtml(html);
        setWebViewTitle("Khalti Payment");
        setShowEsewaWebView(true);
      }

    } catch (err: any) {
      Alert.alert("Payment Error", err.message || "Could not start payment");
    } finally {
      setPayingBillId(null);
    }
  };

  const downloadReceipt = async (paymentId: number) => {
    try {
      setDownloadingReceiptId(paymentId);
      const rawToken = await AsyncStorage.getItem("authToken");
      const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const receiptUrl = `${API_BASE_URL}/api/payments/receipt/${paymentId}`;
      console.log(`[Receipt] Fetching receipt from: ${receiptUrl}`);

      // First, verify the endpoint is working before downloading
      const verifyRes = await fetch(receiptUrl, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);

      if (!verifyRes || !verifyRes.ok) {
        // If HEAD request fails, try GET for detailed error info
        console.log(`[Receipt] Verification failed with status ${verifyRes?.status}, attempting to fetch error details...`);
        try {
          const errorRes = await fetch(receiptUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const errorData = await errorRes.json();
          console.log(`[Receipt] Backend error response:`, errorData);
          throw new Error(errorData.message || `Backend error ${errorRes.status}: ${errorRes.statusText}`);
        } catch (e: any) {
          throw new Error(e.message || "Failed to verify receipt availability");
        }
      }

      console.log(`[Receipt] Verification passed, downloading PDF...`);
      const fileUri = `${FileSystem.documentDirectory}Receipt_${paymentId}.pdf`;

      const downloadResult = await FileSystem.downloadAsync(receiptUrl, fileUri, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`[Receipt] Download result status: ${downloadResult.status}`);
      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      console.log(`[Receipt] PDF saved to: ${downloadResult.uri}`);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        Alert.alert("Success", "Receipt downloaded successfully. You can find it in your files.");
      }
    } catch (error: any) {
      console.error("[Receipt Error]", error);
      const errorMsg = error?.message || "Could not download receipt. Please try again.";
      Alert.alert("Receipt Download Failed", errorMsg);
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setShowEsewaWebView(false);
      if (data.status === "success") {
        Alert.alert("Payment Successful!", "Your payment has been processed.", [
          { text: "OK", onPress: () => { fetchBills(); fetchHistory(); } },
        ]);
      } else {
        Alert.alert("Payment Failed", data.message || "Payment could not be completed.");
      }
    } catch { }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment</Text>
        <Text style={styles.subtitle}>Manage payments and transactions</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "bills" && styles.activeTab]}
          onPress={() => setActiveTab("bills")}
        >
          <Ionicons name="receipt-outline" size={18} color={activeTab === "bills" ? PRIMARY_BLUE : "#999"} />
          <Text style={[styles.tabText, activeTab === "bills" && styles.activeTabText]}>Bills</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => setActiveTab("history")}
        >
          <Ionicons name="time-outline" size={18} color={activeTab === "history" ? PRIMARY_BLUE : "#999"} />
          <Text style={[styles.tabText, activeTab === "history" && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "bills" && (
        loadingBills ? (
          <View style={styles.centeredLoading}><ActivityIndicator size="large" color={PRIMARY_BLUE} /></View>
        ) : (
          <FlatList
            data={bills}
            keyExtractor={(item) => item.BillId.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptyText}>No pending bills at the moment.</Text>
              </View>
            }
            onRefresh={fetchBills}
            refreshing={loadingBills}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.student.Name}</Text>
                    {item.route && (
                      <Text style={styles.routeLabel}>
                        <Ionicons name="navigate" size={11} color="#888" /> {item.route.Name}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.status, getStatusStyle(item.Status)]}>{item.Status.toUpperCase()}</Text>
                </View>
                <View style={styles.billDetails}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Period</Text>
                    <Text style={styles.billValue}>{formatDate(item.PeriodStart)} - {formatDate(item.PeriodEnd)}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Due Date</Text>
                    <Text style={[styles.billValue, new Date(item.DueDate) < new Date() && { color: "#ef4444" }]}>
                      {formatDate(item.DueDate)}
                    </Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Total</Text>
                    <Text style={styles.billValue}>{formatCurrency(item.Amount)}</Text>
                  </View>
                  {(item.remainingAmount ?? item.Amount) < item.Amount && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Remaining</Text>
                      <Text style={[styles.billValue, { color: "#ef4444", fontWeight: "700" }]}>
                        {formatCurrency(item.remainingAmount ?? item.Amount)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.paymentButtonContainer}>
                  <TouchableOpacity
                    style={[styles.payButtonOutline, { borderColor: GREEN }, payingBillId === item.BillId && { opacity: 0.6 }]}
                    onPress={() => handlePayBill(item.BillId, 'esewa')}
                    disabled={payingBillId === item.BillId}
                  >
                    {payingBillId === item.BillId ? (
                      <ActivityIndicator size="small" color={GREEN} />
                    ) : (
                      <>
                        <Image source={require('../assets/images/esewa.png')} style={styles.paymentLogo} resizeMode="contain" />
                        <Text style={[styles.payButtonTextSmall, { color: GREEN }]}>eSewa</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.payButtonOutline, { borderColor: "#ef4444" }, payingBillId === item.BillId && { opacity: 0.6 }]}
                    onPress={() => handlePayBill(item.BillId, 'khalti')}
                    disabled={payingBillId === item.BillId}
                  >
                    {payingBillId === item.BillId ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <>
                        <Image source={require('../assets/images/khalti.png')} style={styles.paymentLogo} resizeMode="contain" />
                        <Text style={[styles.payButtonTextSmall, { color: "#ef4444" }]}>Khalti</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>


              </View>
            )}
          />
        )
      )}

      {activeTab === "history" && (
        loadingHistory ? (
          <View style={styles.centeredLoading}><ActivityIndicator size="large" color={PRIMARY_BLUE} /></View>
        ) : (
          <>
            <FlatList
              data={payments.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE)}
              keyExtractor={(item) => item.PaymentId.toString()}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyTitle}>No Payments Yet</Text>
                  <Text style={styles.emptyText}>Your payment history will appear here.</Text>
                </View>
              }
              onRefresh={fetchHistory}
              refreshing={loadingHistory}
              renderItem={({ item }) => {
                const isKhalti = item.Provider?.toLowerCase() === 'khalti';
                const isEsewa = item.Provider?.toLowerCase() === 'esewa';
                
                return (
                  <View style={styles.historyCard}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyName}>{item.bill?.student?.Name ?? "Unknown"}</Text>
                        {item.bill?.route && (
                          <Text style={styles.routeLabel}>
                            <Ionicons name="navigate" size={11} color="#888" /> {item.bill.route.Name}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.status, getStatusStyle(item.Status)]}>{item.Status.toUpperCase()}</Text>
                        {item.Status === "completed" && (
                          <TouchableOpacity
                            style={[styles.downloadButton, downloadingReceiptId === item.PaymentId && { opacity: 0.6 }]}
                            onPress={() => downloadReceipt(item.PaymentId)}
                            disabled={downloadingReceiptId === item.PaymentId}
                          >
                            {downloadingReceiptId === item.PaymentId ? (
                              <ActivityIndicator size="small" color={PRIMARY_BLUE} />
                            ) : (
                              <View style={styles.downloadButtonContent}>
                                <Ionicons name="download-outline" size={14} color={PRIMARY_BLUE} />
                                <Text style={styles.downloadButtonText}>Receipt</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.cardFooter}>
                      <View>
                        <View style={styles.providerRow}>
                          {isEsewa && <Image source={require('../assets/images/esewa.png')} style={styles.historyLogo} resizeMode="contain" />}
                          {isKhalti && <Image source={require('../assets/images/khalti.png')} style={styles.historyLogo} resizeMode="contain" />}
                          <Text style={styles.amount}>{formatCurrency(item.Amount)}</Text>
                        </View>
                        <Text style={styles.provider}>via {item.Provider}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.date}>{item.PaidAt ? formatDate(item.PaidAt) : ""}</Text>
                      </View>

                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                payments.length > ITEMS_PER_PAGE ? (
                  <View style={styles.paginationContainer}>
                    <TouchableOpacity 
                      disabled={historyPage === 1}
                      onPress={() => setHistoryPage(p => Math.max(1, p - 1))}
                      style={[styles.pageBtn, historyPage === 1 && styles.pageBtnDisabled]}
                    >
                      <Text style={[styles.pageBtnText, historyPage === 1 && styles.pageBtnTextDisabled]}>Previous</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.pageIndicator}>
                      <Text style={styles.pageText}>{historyPage} / {Math.ceil(payments.length / ITEMS_PER_PAGE)}</Text>
                    </View>
    
                    <TouchableOpacity 
                      disabled={historyPage >= Math.ceil(payments.length / ITEMS_PER_PAGE)}
                      onPress={() => setHistoryPage(p => p + 1)}
                      style={[styles.pageBtn, historyPage >= Math.ceil(payments.length / ITEMS_PER_PAGE) && styles.pageBtnDisabled]}
                    >
                      <Text style={[styles.pageBtnText, historyPage >= Math.ceil(payments.length / ITEMS_PER_PAGE) && styles.pageBtnTextDisabled]}>Next</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          </>

        )
      )}


      {/* eSewa WebView Modal */}
      <Modal visible={showEsewaWebView} animationType="slide" onRequestClose={() => setShowEsewaWebView(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFF" }}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Cancel Payment?", "Are you sure you want to cancel?", [
                  { text: "No", style: "cancel" },
                  { text: "Yes", style: "destructive", onPress: () => setShowEsewaWebView(false) },
                ]);
              }}
              style={styles.webViewCloseBtn}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>{webViewTitle}</Text>
            <View style={{ width: 40 }} />
          </View>
          <WebView
            source={{ html: webViewHtml }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={DEEP_BLUE} />
                <Text style={{ marginTop: 10, color: "#666" }}>Loading {webViewTitle}...</Text>
              </View>
            )}
          />

        </SafeAreaView>
      </Modal>

      <Navigation />
    </SafeAreaView>
  );
}

// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
// STYLES
// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centeredLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "bold", color: DEEP_BLUE },
  subtitle: { fontSize: 16, color: "#666" },

  // Tabs
  tabsContainer: { flexDirection: "row", paddingHorizontal: 16, marginTop: 8, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  tab: { flexDirection: "row", alignItems: "center", paddingVertical: 10, marginRight: 20, borderBottomWidth: 3, borderBottomColor: "transparent", gap: 5 },
  activeTab: { borderBottomColor: PRIMARY_BLUE },
  tabText: { fontSize: 14, color: "#999", fontWeight: "600" },
  activeTabText: { color: PRIMARY_BLUE },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 12 },
  emptyText: { fontSize: 14, color: "#888", marginTop: 4 },

  // Card
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 16, fontWeight: "700", color: "#333" },
  routeLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  parentLabel: { fontSize: 12, color: "#999", marginTop: 1 },
  status: { fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  statusPaid: { backgroundColor: "#E7F6EC", color: "#2E7D32" },
  statusPending: { backgroundColor: "#FFF4E5", color: "#E65100" },
  statusOverdue: { backgroundColor: "#FDECEA", color: "#C62828" },

  // Bill details
  billDetails: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  billLabel: { fontSize: 13, color: "#888" },
  billValue: { fontSize: 13, color: "#333", fontWeight: "500" },

  // Student row (admin)
  studentRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3 },
  studentName: { fontSize: 13, color: "#333", fontWeight: "500" },
  moreText: { fontSize: 12, color: "#999", marginTop: 4 },

  // Buttons
  generateButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: DEEP_BLUE, borderRadius: 10, padding: 12, marginTop: 14, gap: 8 },
  generateButtonText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  viewBillsButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: DEEP_BLUE, borderRadius: 10, padding: 10, marginTop: 8, gap: 6 },
  viewBillsText: { color: DEEP_BLUE, fontWeight: "600", fontSize: 14 },
  payButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: GREEN, borderRadius: 10, padding: 12, marginTop: 14, gap: 8 },
  payButtonOutline: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", borderRadius: 10, padding: 10, borderWidth: 1.5, gap: 8 },
  payButtonText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  payButtonTextSmall: { fontWeight: "700", fontSize: 13 },
  paymentButtonContainer: { flexDirection: "row", gap: 10, marginTop: 14 },
  paymentLogo: { width: 24, height: 24 },
  historyLogo: { width: 16, height: 16, marginRight: 6 },
  providerRow: { flexDirection: "row", alignItems: "center" },
  historyCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginTop: 12, borderLeftWidth: 4, borderLeftColor: PRIMARY_BLUE, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  historyName: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 2 },
  
  // Pagination
  paginationContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, marginTop: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#f0f7ff" },

  pageBtnDisabled: { backgroundColor: "#fafafa" },
  pageBtnText: { color: PRIMARY_BLUE, fontWeight: "700", fontSize: 14 },
  pageBtnTextDisabled: { color: "#ccc" },
  pageIndicator: { alignItems: "center" },
  pageText: { fontSize: 13, color: "#666", fontWeight: "600" },





  // Filter bar
  filterBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#E8F4FD" },
  filterText: { fontSize: 13, color: DEEP_BLUE, fontWeight: "600" },

  // Footer
  cardFooter: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  amount: { fontSize: 16, fontWeight: "700", color: PRIMARY_BLUE },
  provider: { fontSize: 11, color: "#999", marginTop: 2 },
  date: { fontSize: 12, color: "#777" },
  refId: { fontSize: 10, color: "#aaa", marginTop: 2 },

  // Download Button
  downloadButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PRIMARY_BLUE,
    backgroundColor: "#f0f4ff",
  },
  downloadButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  downloadButtonText: {
    fontSize: 12,
    color: PRIMARY_BLUE,
    fontWeight: "bold",
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  modalRouteInfo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F0F7FF", padding: 12, borderRadius: 12, marginBottom: 16 },
  modalRouteName: { fontSize: 16, fontWeight: "700", color: DEEP_BLUE, flex: 1 },
  modalRouteCount: { fontSize: 13, color: "#666" },
  formContainer: { maxHeight: 300 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: Platform.OS === "ios" ? 14 : 10, fontSize: 15, color: "#333", backgroundColor: "#FAFAFA" },
  calculationBreakdown: { backgroundColor: "#F0F7FF", borderRadius: 10, padding: 12, marginVertical: 12, borderLeftWidth: 4, borderLeftColor: PRIMARY_BLUE },
  breakdownLabel: { fontSize: 12, fontWeight: "600", color: DEEP_BLUE, marginBottom: 6 },
  breakdownText: { fontSize: 12, color: "#333", lineHeight: 18, fontFamily: "monospace" },
  breakdownNote: { fontSize: 11, color: "#888", marginTop: 6, fontStyle: "italic" },

  // WebView
  webViewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  webViewCloseBtn: { padding: 8 },
  webViewTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  webViewLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
});
