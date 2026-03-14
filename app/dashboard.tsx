import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import Navigation from "../components/navigation";
import socket, { connectSocket, disconnectSocket } from "../utils/socket";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface OrganizationData {
  name: string;
  logo: any;
  email: string;
  contact: string;
  address: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [organizationData, setOrganizationData] = useState<OrganizationData & {
    role?: string;
    parentName?: string;
    routeName?: string;
    driverName?: string;
    driverPhone?: string;
    busNumber?: string;
    children?: Array<{
      name: string;
      routeName: string | null;
      driverName: string | null;
      driverPhone: string | null;
      busNumber: string | null;
    }>;
    scheduleDays?: string;
    startTime?: string;
    assignedRouteId?: number | null;
    assignedBusId?: number | null;
  }>({
    name: "Loading...",
    logo: require("../assets/images/logo.png"),
    email: "Loading...",
    contact: "Loading...",
    address: "Loading...",
  });
  const [loading, setLoading] = useState(true);
  const [isTripStarted, setIsTripStarted] = useState(false);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [allRoutes, setAllRoutes] = useState<any[]>([]);

  // Responsive sizing
  const isSmallScreen = width < 375;
  const numColumns = width < 350 ? 2 : 3;

  useEffect(() => {
    loadOrganizationData();
  }, []);

  const decodeJWT = (token: string) => {
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
  };

  const loadOrganizationData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        const decoded = decodeJWT(token);
        if (decoded) {
          console.log("Decoded Token:", decoded);
          // Prioritize user details from token
          const userName = decoded.name || decoded.Name || decoded.organizationName || "Welcome User";
          const userEmail = decoded.email || decoded.Email || "";
          const userPhone = decoded.phone || decoded.Phone || decoded.contact || "";
          const userAddress = decoded.address || decoded.Address || "";
          const userRole = decoded.role || decoded.Role || "user";
          const parentName = decoded.parentName || null;
          const routeName = decoded.routeName || null;
          const children = decoded.children || [];

          setOrganizationData({
            name: userName,
            logo: require("../assets/images/logo.png"),
            email: userEmail,
            contact: userPhone,
            address: userAddress,
            role: userRole,
            parentName: parentName,
            routeName: routeName,
            driverName: decoded.driverName || null,
            driverPhone: decoded.driverPhone || null,
            busNumber: decoded.busNumber || null,
            children: children,
            scheduleDays: decoded.scheduleDays || null,
            startTime: decoded.startTime || null,
            assignedRouteId: decoded.routeId || decoded.RouteId || (await AsyncStorage.getItem("assignedRouteId") ? Number(await AsyncStorage.getItem("assignedRouteId")) : null),
            assignedBusId: decoded.busId || decoded.BusId || (await AsyncStorage.getItem("assignedBusId") ? Number(await AsyncStorage.getItem("assignedBusId")) : null),
          });
          console.log("Assigned IDs loaded:", {
            routeId: decoded.routeId || decoded.RouteId,
            busId: decoded.busId || decoded.BusId
          });

          // If student, fetch their full schedule explicitly to be sure
          if (userRole.toLowerCase() === "student") {
            try {
              const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/routes/student-schedule/view`, {
                headers: { Authorization: `Bearer ${token.startsWith("Bearer ") ? token.slice(7) : token}` }
              });
              const data = await res.json();
              if (data.scheduleDays) {
                setOrganizationData(prev => ({
                  ...prev,
                  scheduleDays: data.scheduleDays,
                  startTime: data.startTime
                }));
              }
            } catch (error) {
              console.error("Error fetching explicit student schedule:", error);
            }
          }

          // If Admin, fetch all routes for organization-wide view
          if (userRole.toLowerCase() === "admin" || userRole.toLowerCase() === "orgadmin") {
            try {
              const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
                headers: { Authorization: `Bearer ${token.startsWith("Bearer ") ? token.slice(7) : token}` }
              });
              const data = await res.json();
              if (data.routes) {
                setAllRoutes(data.routes);
              }
            } catch (error) {
              console.error("Error fetching organization routes:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading organization data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationData.role) {
      // Connect to socket when dashboard loads
      connectSocket(organizationData.assignedRouteId || undefined);

      socket.on("notification", (notif) => {
        Alert.alert("Bus Update", notif.message);
      });

      return () => {
        socket.off("notification");
        disconnectSocket();
      };
    }
  }, [organizationData.role, organizationData.routeName]);

  const handleStartTrip = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      // For demo, we assume the first route/bus is used if none assigned
      console.log("Starting trip with payload:", {
        routeId: organizationData.assignedRouteId,
        busId: organizationData.assignedBusId
      });

      if (!organizationData.assignedRouteId || !organizationData.assignedBusId) {
        Alert.alert("Missing Data", "Your driver profile is missing an assigned route or bus. Please contact your admin.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/trips/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          routeId: organizationData.assignedRouteId,
          busId: organizationData.assignedBusId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsTripStarted(true);
        setActiveTripId(data.trip.TripId);
        Alert.alert("Success", "Trip started! Students are being notified.");
      } else {
        Alert.alert("Error", data.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start trip");
    }
  };

  const handleEndTrip = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/api/trips/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tripId: activeTripId })
      });
      if (res.ok) {
        setIsTripStarted(false);
        setActiveTripId(null);
        Alert.alert("Success", "Trip ended successfully.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to end trip");
    }
  };

  const getFilteredTodaysTrips = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayName = dayNames[new Date().getDay()];

    return allRoutes
      .filter(r => {
        if (r.ScheduleDays === "Daily") return true;
        const days = r.ScheduleDays.split(',').map((d: string) => d.trim());
        return days.includes(todayName);
      })
      .map(r => ({
        id: r.RouteId,
        route: r.Name,
        time: r.StartTime
      }));
  };

  const todaysTrips = allRoutes.length > 0 ? getFilteredTodaysTrips() : [
    { id: 1, route: "Route A - Baneshwor to School", time: "07:00 AM" },
    { id: 2, route: "Route B - Koteshwor to School", time: "07:30 AM" },
    { id: 3, route: "Route C - Thamel to School", time: "08:00 AM" },
    { id: 4, route: "Route A - School to Baneshwor", time: "03:00 PM" },
    { id: 5, route: "Route B - School to Koteshwor", time: "03:30 PM" },
    { id: 6, route: "Route C - School to Thamel", time: "04:00 PM" },
  ];

  const quickActions = [
    { id: 1, name: "Driver", icon: "car" as const, color: "#3B82F6" },
    { id: 2, name: "Student", icon: "school" as const, color: "#2563EB" },
    { id: 3, name: "Parent", icon: "people" as const, color: "#1D4ED8" },
    { id: 4, name: "Schedule", icon: "calendar" as const, color: "#2563EB" },
    { id: 5, name: "Payment", icon: "card" as const, color: "#1E40AF" },
    { id: 6, name: "Notice", icon: "notifications" as const, color: "#0891B2" },
  ];

  const handleQuickAction = (actionName: string) => {
    console.log(`${actionName} action pressed`);
    // Add navigation or action logic here
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (organizationData.role?.toLowerCase() === "driver") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Premium Driver Pass Header */}
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            style={styles.idCardContainer}
          >
            <View style={styles.idCardDecor} />

            <View style={styles.idCardHeader}>
              <View style={[styles.logoContainer, { backgroundColor: "#FFF" }]}>
                <Image
                  source={require("../assets/images/logo.png")}
                  style={styles.idLogo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                style={styles.notificationBell}
                onPress={() => router.push("/notifications")}
              >
                <Ionicons name="notifications-outline" size={22} color="#64748B" />
                <View style={styles.bellBadge} />
              </TouchableOpacity>
            </View>

            <View style={styles.idCardBody}>
              <View style={styles.nameSection}>
                <Text style={[styles.idRoleLabel, { color: "#3B82F6" }]}>PROFESSIONAL DRIVER PASS</Text>
                <Text style={styles.idNameValue}>{organizationData.name}</Text>
                <View style={styles.emailContainer}>
                  <Ionicons name="mail-outline" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  <Text style={[styles.idEmailValue, { color: "#64748B" }]}>{organizationData.email}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>ASSIGNED ROUTE</Text>
                  <Text style={styles.statValue}>{organizationData.routeName || "N/A"}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: "rgba(255, 255, 255, 0.1)" }]} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>VEHICLE</Text>
                  <Text style={styles.statValue}>BA 2 KA 4567</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Trip Control Section */}
          <View style={styles.tripControlSection}>
            <Text style={styles.sectionTitle}>Trip Control</Text>
            <TouchableOpacity
              style={[
                styles.tripBtn,
                isTripStarted ? styles.endTripBtn : styles.startTripBtn
              ]}
              onPress={isTripStarted ? handleEndTrip : handleStartTrip}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isTripStarted ? "stop-circle" : "play-circle"}
                size={28}
                color="#FFF"
              />
              <Text style={styles.tripBtnText}>
                {isTripStarted ? "End Trip Now" : "Start Today's Trip"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.tripHint}>
              {isTripStarted ? "Tracking is live. Students can see you now." : "Click start to begin tracking for students."}
            </Text>
          </View>

          {/* Today's Trip Section for Driver */}
          <View style={styles.driverScheduleSection}>
            <Text style={styles.sectionTitle}>Today's Assignments</Text>
            <View style={styles.scheduleList}>
              {todaysTrips.slice(0, 3).map((trip) => (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={styles.tripRoute}>
                    <Ionicons name="bus" size={20} color="#3B82F6" />
                    <View>
                      <Text style={styles.routeText}>{trip.route}</Text>
                      <Text style={styles.tripTimeDetail}>{trip.time}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  }

  if (organizationData.role?.toLowerCase() === "parent") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Premium Family Pass Header */}
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            style={styles.idCardContainer}
          >
            <View style={styles.idCardDecor} />

            <View style={styles.idCardHeader}>
              <View style={[styles.logoContainer, { backgroundColor: "#FFF" }]}>
                <Image
                  source={require("../assets/images/logo.png")}
                  style={styles.idLogo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                style={styles.notificationBell}
                onPress={() => router.push("/notifications")}
              >
                <Ionicons name="notifications-outline" size={22} color="#64748B" />
                <View style={styles.bellBadge} />
              </TouchableOpacity>
            </View>

            <View style={styles.idCardBody}>
              <View style={styles.nameSection}>
                <Text style={[styles.idRoleLabel, { color: "#3B82F6" }]}>FAMILY PASS & OVERSIGHT</Text>
                <Text style={styles.idNameValue}>{organizationData.name}</Text>
                <View style={styles.emailContainer}>
                  <Ionicons name="people-outline" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  <Text style={[styles.idEmailValue, { color: "#64748B" }]}>Viewing Family Activity</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CHILD</Text>
                  <Text style={styles.statValue}>
                    {organizationData.children && organizationData.children.length > 0
                      ? organizationData.children[0].name
                      : "No Student Added"}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: "rgba(255, 255, 255, 0.1)" }]} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>PRIMARY ROUTE</Text>
                  <Text style={styles.statValue}>
                    {organizationData.children && organizationData.children.length > 0
                      ? organizationData.children[0].routeName || "Not Assigned"
                      : "N/A"}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: "rgba(255, 255, 255, 0.1)" }]} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>BUS</Text>
                  <Text style={styles.statValue}>
                    {organizationData.children && organizationData.children.length > 0
                      ? organizationData.children[0].busNumber || "N/A"
                      : "N/A"}
                  </Text>
                </View>
              </View>

              <View style={[styles.statsRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 }]}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>DRIVER</Text>
                  <Text style={styles.statValue}>
                    {organizationData.children && organizationData.children.length > 0
                      ? organizationData.children[0].driverName || "Assigning..."
                      : "N/A"}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: "rgba(255, 255, 255, 0.1)" }]} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CONTACT</Text>
                  <Text style={styles.statValue}>
                    {organizationData.children && organizationData.children.length > 0
                      ? organizationData.children[0].driverPhone || "N/A"
                      : "N/A"}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Billing Overview Section */}
          <View style={styles.billingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Billing & Payments</Text>
              <TouchableOpacity onPress={() => router.push("/billing")}>
                <Text style={styles.viewAllBtn}>History</Text>
              </TouchableOpacity>
            </View>
            <LinearGradient
              colors={["#FFFFFF", "#F9FAFB"]}
              style={styles.billingCard}
            >
              <View style={styles.billRow}>
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>Balance Due</Text>
                  <Text style={styles.billValue}>Rs. 2,500</Text>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>Next Due</Text>
                  <Text style={styles.billValue}>Feb 28</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.payBtn}>
                <Text style={styles.payBtnText}>Pay Now</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Quick Info Section */}
          <View style={styles.familyActivitySection}>
            <Text style={styles.sectionTitle}>Family Activity</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Ionicons name="bus" size={24} color="#3B82F6" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityText}>
                  {organizationData.children && organizationData.children.length > 0
                    ? `${organizationData.children[0].name} has boarded ${organizationData.children[0].routeName || "Bus"}`
                    : "No student activity to show"}
                </Text>
                <Text style={styles.activityTime}>Just Now</Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>Live</Text>
              </View>
            </View>
          </View>
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  }

  if (organizationData.role?.toLowerCase() === "student") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Premium Student Pass Header */}
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            style={styles.idCardContainer}
          >
            {/* Decorative background circle */}
            <View style={styles.idCardDecor} />

            <View style={styles.idCardHeader}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/images/logo.png")}
                  style={styles.idLogo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                style={styles.notificationBell}
                onPress={() => router.push("/notifications")}
              >
                <Ionicons name="notifications-outline" size={22} color="#64748B" />
                <View style={styles.bellBadge} />
              </TouchableOpacity>
            </View>

            <View style={styles.idCardBody}>
              <View style={styles.nameSection}>
                <Text style={styles.idRoleLabel}>DIGITAL STUDENT PASS</Text>
                <Text style={styles.idNameValue}>{organizationData.name}</Text>
                <View style={styles.emailContainer}>
                  <Ionicons name="mail-outline" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  <Text style={styles.idEmailValue}>{organizationData.email}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>ROUTE</Text>
                  <Text style={styles.statValue}>{organizationData.routeName || "N/A"}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>DRIVER</Text>
                  <Text style={styles.statValue}>{organizationData.driverName || "N/A"}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>BUS</Text>
                  <Text style={styles.statValue}>{organizationData.busNumber || "N/A"}</Text>
                </View>
              </View>

              <View style={[styles.statsRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 }]}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CONTACT</Text>
                  <Text style={styles.statValue}>{organizationData.driverPhone || "N/A"}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Bus Deployment Section with consistent styling */}
          <View style={styles.attendanceContainer}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.atTitle}>Bus Start Schedule</Text>
                <Text style={styles.atSubtitle}>Check daily departure times</Text>
              </View>
              <View style={styles.atYearBtn}>
                <Text style={styles.atYearText}>Feb 2026</Text>
              </View>
            </View>
            <View style={styles.simpleCalendar}>
              <View style={styles.weekRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <View key={i} style={styles.dayCol}>
                    <Text style={styles.dayLabel}>{d}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {(() => {
                  const firstDayOfMonth = new Date(2026, 1, 1).getDay(); // 0 is Sunday
                  // Our week row starts with Monday
                  const paddingDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                  const daysInMonth = 28; // Feb 2026

                  const cells = [];
                  // Add empty padding cells
                  for (let p = 0; p < paddingDays; p++) {
                    cells.push(<View key={`pad-${p}`} style={styles.dayCell} />);
                  }

                  // Add day cells
                  for (let day = 1; day <= daysInMonth; day++) {
                    const isToday = day === 5;
                    const date = new Date(2026, 1, day);
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const currentDayName = dayNames[date.getDay()];

                    const activeDays = organizationData.scheduleDays === "Daily"
                      ? dayNames
                      : (organizationData.scheduleDays?.split(",").map(d => d.trim()) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

                    const hasStartTime = activeDays.includes(currentDayName);

                    cells.push(
                      <View key={`day-${day}`} style={[styles.dayCell, isToday && styles.todayCell]}>
                        <Text style={[styles.dayText, isToday && styles.todayText]}>{day}</Text>
                        {hasStartTime && (
                          <Text style={[styles.startTimeLabel, isToday && styles.todayStartTime]}>
                            {organizationData.startTime || "07:30"}
                          </Text>
                        )}
                      </View>
                    );
                  }
                  return cells;
                })()}
              </View>
            </View>
          </View>
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Organization Card */}
        <TouchableOpacity
          style={styles.orgCard}
          onPress={() => router.push("/myprofile")}
          activeOpacity={0.7}
        >
          <View style={styles.orgHeader}>
            <Image
              source={organizationData.logo}
              style={styles.orgLogo}
              resizeMode="contain"
            />
            <Text style={styles.orgName}>{organizationData.name}</Text>
            <TouchableOpacity
              style={[styles.notificationBell, { backgroundColor: "#f0f0f0" }]}
              onPress={() => router.push("/notifications")}
            >
              <Ionicons name="notifications-outline" size={22} color="#666" />
              <View style={styles.bellBadge} />
            </TouchableOpacity>
          </View>
          <View style={styles.orgDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="mail" size={16} color="#666" />
              <Text style={styles.detailText}>{organizationData.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={16} color="#666" />
              <Text style={styles.detailText}>{organizationData.contact}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={16} color="#666" />
              <Text style={styles.detailText}>{organizationData.address}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionItem,
                  { width: `${100 / numColumns - 4}%` },
                ]}
                onPress={() => handleQuickAction(action.name)}
              >
                <View
                  style={[
                    styles.actionIconContainer,
                    { backgroundColor: action.color },
                  ]}
                >
                  <Ionicons name={action.icon} size={30} color="#fff" />
                </View>
                <Text style={styles.actionText}>{action.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Today's Trip Schedule Section */}
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Today's Trip Schedule</Text>
          <View style={styles.scheduleList}>
            {todaysTrips.map((trip) => (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripRoute}>
                  <Ionicons name="bus" size={20} color="#3B82F6" />
                  <Text style={styles.routeText}>{trip.route}</Text>
                </View>
                <Text style={styles.timeText}>{trip.time}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  orgCard: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orgHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orgLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#f0f0f0",
  },
  orgName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    flexWrap: "wrap",
  },
  orgDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  detailText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  quickActionsSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  actionItem: {
    minWidth: "30%",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
    textAlign: "center",
  },
  scheduleSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  scheduleList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  routeText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  idCardContainer: {
    margin: 20,
    borderRadius: 24,
    padding: 24,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    position: "relative",
  },
  idCardDecor: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    zIndex: 0,
  },
  idCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    zIndex: 1,
  },
  logoContainer: {
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  idLogo: {
    width: 32,
    height: 32,
  },
  notificationBell: {
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
  },
  bellBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3B82F6",
  },
  idCardBody: {
    zIndex: 1,
  },
  nameSection: {
    marginBottom: 24,
  },
  idRoleLabel: {
    fontSize: 10,
    color: "#3B82F6",
    letterSpacing: 1.5,
    fontWeight: "bold",
    marginBottom: 6,
  },
  idNameValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  idEmailValue: {
    fontSize: 13,
    color: "#64748B",
  },
  billingSection: {
    margin: 20,
    marginTop: 0,
  },
  viewAllBtn: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "bold",
  },
  billingCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  billItem: {
    flex: 1,
  },
  billLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  billValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  billDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 15,
  },
  payBtn: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  payBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  familyActivitySection: {
    margin: 20,
    marginTop: 0,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  activityTime: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1D4ED8",
    textTransform: "uppercase",
  },
  tripControlSection: {
    margin: 20,
    marginTop: 0,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  tripBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  startTripBtn: {
    backgroundColor: "#3B82F6",
  },
  endTripBtn: {
    backgroundColor: "#F43F5E",
  },
  tripBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  tripHint: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
  driverScheduleSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  tripTimeDetail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    color: "#E2E8F0",
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginHorizontal: 12,
  },
  attendanceContainer: {
    margin: 20,
    marginTop: 0,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  atTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  atSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  atYearBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  atYearText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
  },
  simpleCalendar: {
    marginTop: 24,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayCol: {
    flex: 1,
    alignItems: "center",
  },
  dayLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "800",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayCell: {
    width: `${100 / 7.2}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderRadius: 12,
  },
  todayCell: {
    backgroundColor: "#0F172A",
  },
  dayText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  todayText: {
    color: "#FFF",
    fontWeight: "800",
  },
  startTimeLabel: {
    fontSize: 8,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  todayStartTime: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3B82F6",
    position: "absolute",
    bottom: 6,
  },
});
