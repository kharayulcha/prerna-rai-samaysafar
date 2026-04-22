import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from "react-native";
import Navigation from "../components/navigation";
import socket, {
    connectSocket,
    disconnectSocket,
    emitLocationUpdate,
} from "../utils/socket";
import StudentProfileModal from "./StudentProfile";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

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
  const [organizationData, setOrganizationData] = useState<
    OrganizationData & {
      role?: string;
      parentName?: string;
      routeName?: string;
      driverName?: string;
      driverPhone?: string | null;
      busNumber?: string;
      children?: {
        name: string;
        routeName: string | null;
        driverName: string | null;
        driverPhone: string | null;
        busNumber: string | null;
      }[];
      scheduleDays?: string;
      startTime?: string;
      assignedRouteId?: number | null;
      assignedBusId?: number | null;
    }
  >({
    name: "Loading...",
    logo: require("../assets/images/logo.png"),
    email: "Loading...",
    contact: "Loading...",
    address: "Loading...",
  });
  const [loading, setLoading] = useState(true);
  const [isTripStarted, setIsTripStarted] = useState(false);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [, setAllRoutes] = useState<any[]>([]);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  // --- BILLING STATE ---
  const [balanceDue, setBalanceDue] = useState<number>(0);
  const [nextDueDate, setNextDueDate] = useState<string>("--");
  const [showProfileModal, setShowProfileModal] = useState(false);

  // --- NOTICE MODAL STATE ---
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeHeader, setNoticeHeader] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [isSendingNotice, setIsSendingNotice] = useState(false);

  const [tripSchedule, setTripSchedule] = useState<
    { route: string; time: string }[]
  >([]);

  // --- REPORT MODAL STATE ---
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportType, setReportType] = useState<"trips" | "payments">("trips");
  const [isFetchingReport, setIsFetchingReport] = useState(false);

  // --- NOTIFICATION STATE ---
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const handleNotificationPress = () => {
    setHasUnreadNotifications(false);
    router.push("/notifications");
  };

  const numColumns = width < 350 ? 2 : 3;

  const decodeJWT = useCallback((token: string) => {
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
  }, []);

  const formatTimeStr = useCallback((timeStr: string) => {
    if (!timeStr || timeStr === "--") return timeStr;
    // Check if it already contains AM/PM
    if (
      timeStr.toLowerCase().includes("am") ||
      timeStr.toLowerCase().includes("pm")
    )
      return timeStr;

    // Try to parse HH:mm or HH:mm:ss
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      let hours = parseInt(parts[0]);
      let minutes = parts[1].substring(0, 2);
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return timeStr;
  }, []);

  const loadOrganizationData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const storedLogo = await AsyncStorage.getItem("organizationLogo");

      console.log(
        "[Dashboard] Stored logo:",
        storedLogo ? `${storedLogo.substring(0, 50)}...` : "None",
      );

      if (token) {
        let decoded = decodeJWT(token);
        let freshUser: any = null;

        // Fetch fresh data from DB to catch real-time assignments
        try {
          const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            freshUser = data.user;
            // Update local storage so other screens can use it too
            await AsyncStorage.setItem("userData", JSON.stringify(freshUser));
          }
        } catch (e) {
          console.log("[Dashboard] Remote profile fetch failed:", e);
        }

        const userDataString = await AsyncStorage.getItem("userData");
        let profileImageFromData = null;
        if (userDataString) {
          try {
            const userData = JSON.parse(userDataString);
            profileImageFromData =
              userData.ProfileImage || userData.profileImage;
          } catch (e) {
            console.error("Error parsing userData in dashboard:", e);
          }
        }

        if (decoded) {
          // Prioritize data from DB (freshUser), fallback to decoded JWT
          const userName =
            freshUser?.name ||
            decoded.name ||
            decoded.Name ||
            decoded.organizationName ||
            "Welcome User";
          const userEmail =
            freshUser?.email || decoded.email || decoded.Email || "";
          const userPhone =
            freshUser?.phone ||
            decoded.phone ||
            decoded.Phone ||
            decoded.contact ||
            "";
          const userAddress =
            freshUser?.address || decoded.address || decoded.Address || "";
          const userRole = (
            freshUser?.role ||
            decoded.role ||
            decoded.Role ||
            "user"
          ).toLowerCase();
          const parentName =
            freshUser?.parentName || decoded.parentName || null;
          const routeName = freshUser?.routeName || decoded.routeName || null;
          const children = freshUser?.children || decoded.children || [];
          const busNumber = freshUser?.busNumber || decoded.busNumber || null;
          const driverName =
            freshUser?.driverName || decoded.driverName || null;
          const driverPhone =
            freshUser?.driverPhone || decoded.driverPhone || null;

          // Determine logo source - prefer stored image, fallback to profile image, then default
          let logoSource: any = require("../assets/images/logo.png");
          
          if (storedLogo) {
            const logoUrl = getImageUrl(storedLogo);
            if (logoUrl) {
              logoSource = { uri: logoUrl };
            }
          } else if (profileImageFromData) {
            const profileUrl = getImageUrl(profileImageFromData);
            if (profileUrl) {
              logoSource = { uri: profileUrl };
            }
          }

          setOrganizationData({
            name: userName,
            logo: logoSource,
            email: userEmail,
            contact: userPhone,
            address: userAddress,
            role: userRole,
            parentName: parentName,
            routeName: routeName,
            driverName: driverName,
            driverPhone: driverPhone,
            busNumber: busNumber,
            children: children,
            scheduleDays: decoded.scheduleDays || null,
            startTime: decoded.startTime || null,
            assignedRouteId:
              decoded.routeId ||
              decoded.RouteId ||
              ((await AsyncStorage.getItem("assignedRouteId"))
                ? Number(await AsyncStorage.getItem("assignedRouteId"))
                : null),
            assignedBusId:
              decoded.busId ||
              decoded.BusId ||
              ((await AsyncStorage.getItem("assignedBusId"))
                ? Number(await AsyncStorage.getItem("assignedBusId"))
                : null),
          });
          console.log("Assigned IDs loaded:", {
            routeId:
              decoded.routeId ??
              decoded.RouteId ??
              "Not assigned (checked AsyncStorage as fallback)",
            busId:
              decoded.busId ??
              decoded.BusId ??
              "Not assigned (checked AsyncStorage as fallback)",
            role: userRole,
          });

          // If student, fetch their full schedule explicitly to be sure
          if (userRole.toLowerCase() === "student") {
            try {
              const res = await fetch(
                `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/routes/student-schedule/view`,
                {
                  headers: {
                    Authorization: `Bearer ${token.startsWith("Bearer ") ? token.slice(7) : token}`,
                  },
                },
              );
              const data = await res.json();
              if (data.scheduleDays) {
                setOrganizationData((prev) => ({
                  ...prev,
                  scheduleDays: data.scheduleDays,
                  startTime: data.startTime,
                }));
              }
            } catch (error) {
              console.error("Error fetching explicit student schedule:", error);
            }
          }

          // --- FETCH BILLING INFO FOR PARENT ---
          if (userRole.toLowerCase() === "parent") {
            try {
              const res = await fetch(`${API_BASE_URL}/api/payments/bills`, {
                headers: {
                  Authorization: `Bearer ${token.startsWith("Bearer ") ? token.slice(7) : token}`,
                  "Content-Type": "application/json",
                },
              });
              const data = await res.json();
              if (res.ok && data.bills) {
                let totalPending = 0;
                let soonestDue: Date | null = null;

                (data.bills || []).forEach((bill: any) => {
                  const paidSoFar = (bill.payments ?? [])
                    .filter((p: any) => p.Status === "completed")
                    .reduce((sum: number, p: any) => sum + p.Amount, 0);

                  const remaining = bill.Amount - paidSoFar;
                  if (remaining > 0) {
                    totalPending += remaining;
                    const dDate = new Date(bill.DueDate);
                    if (!soonestDue || dDate < soonestDue) {
                      soonestDue = dDate;
                    }
                  }
                });

                setBalanceDue(totalPending);
                if (soonestDue) {
                  const d = soonestDue as Date;
                  const months = [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ];
                  setNextDueDate(
                    `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
                  );
                }
              }
            } catch (err) {
              console.warn("Failed to fetch dashboard billing stats:", err);
            }
          }

          // If Admin, fetch all routes for organization-wide view
          if (
            userRole.toLowerCase() === "admin" ||
            userRole.toLowerCase() === "orgadmin"
          ) {
            try {
              const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
                headers: {
                  Authorization: `Bearer ${token.startsWith("Bearer ") ? token.slice(7) : token}`,
                },
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
  }, [decodeJWT]);

  useFocusEffect(
    useCallback(() => {
      loadOrganizationData();
    }, [loadOrganizationData]),
  );

  useEffect(() => {
    if (organizationData.role) {
      // Setup socket rooms based on user role/ID
      const setupSocketRooms = async () => {
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          const decoded = decodeJWT(token);
          const userId = decoded?.userId || decoded?.UserId || null;

          // Connect/Join common route room for trip updates
          connectSocket(organizationData.assignedRouteId || undefined);

          // Join private user room for bills/payment notifications
          if (userId) {
            console.log("[Dashboard] Joining personal room:", `user-${userId}`);
            socket.emit("join-user", userId);
          }
        }
      };

      setupSocketRooms();

      socket.on("notification", (notif) => {
        console.log("[Dashboard] Real-time notification:", notif.message);
        setHasUnreadNotifications(true);
        // Persist unread status for app restarts
        AsyncStorage.setItem("hasUnreadNotifications", "true");
        // Show immediate alert to user
        Alert.alert("New Update", notif.message);
      });

      return () => {
        socket.off("notification");
        disconnectSocket();
      };
    }
  }, [organizationData.assignedRouteId, organizationData.role]);

  // Fetch active trip for driver when dashboard comes into focus
  useFocusEffect(
    useCallback(() => {
      const checkActiveTrip = async () => {
        try {
          if (organizationData.role?.toLowerCase() !== "driver") {
            return;
          }

          const token = await AsyncStorage.getItem("authToken");
          if (!token) {
            return;
          }

          const res = await fetch(`${API_BASE_URL}/api/trips/my-active`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await res.json();

          // Check both success (200) and error (404) responses
          if (res.ok && data.trip && data.trip.TripId) {
            // Active trip found - restore the trip state
            setIsTripStarted(true);
            setActiveTripId(data.trip.TripId);
          } else {
            // No active trip (404 or any other error) - reset state
            setIsTripStarted(false);
            setActiveTripId(null);
            setIsGpsActive(false);
            // Stop GPS tracking if it's running
            if (locationWatchRef.current) {
              locationWatchRef.current.remove();
              locationWatchRef.current = null;
            }
          }
        } catch (error) {
          console.error("Error checking active trip:", error);
          // On error, reset state
          setIsTripStarted(false);
          setActiveTripId(null);
          setIsGpsActive(false);
        }
      };

      if (organizationData.role) {
        checkActiveTrip();
      }
    }, [organizationData.role]),
  );

  // Fetch today's trip schedule from API
  useEffect(() => {
    const fetchTodaySchedule = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (!token) {
          setTripSchedule([]);
          return;
        }

        // Fetch all routes from API
        const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
          headers: {
            Authorization: `Bearer ${token.startsWith("Bearer ") ? token.slice(7) : token}`,
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          console.log("DEBUG: All routes fetched:", data.routes);

          // Get today's day name
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const todayIndex = new Date().getDay();
          const todayName = days[todayIndex];
          console.log("DEBUG: Today is:", todayName, "Index:", todayIndex);

          // Filter routes that are scheduled for today
          const todaySchedules = (data.routes || [])
            .filter((route: any) => {
              const scheduleDays = route.ScheduleDays || "";
              console.log(
                "DEBUG: Route:",
                route.Name,
                "ScheduleDays:",
                scheduleDays,
                "Includes today:",
                scheduleDays.includes(todayName),
              );
              // Check if today's day is included in the schedule
              return scheduleDays.includes(todayName);
            })
            .map((route: any) => ({
              route: route.Name || "Unknown Route",
              time: formatTimeStr(route.StartTime || "--"),
            }));

          console.log("DEBUG: Filtered today schedules:", todaySchedules);
          setTripSchedule(todaySchedules);
        } else {
          console.warn("Failed to fetch routes:", res.status);
          setTripSchedule([]);
        }
      } catch (error) {
        console.error("Error fetching today's trip schedule:", error);
        setTripSchedule([]);
      }
    };

    fetchTodaySchedule();
  }, []);

  const handleStartTrip = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      console.log("Starting trip with payload:", {
        routeId: organizationData.assignedRouteId,
        busId: organizationData.assignedBusId,
      });

      if (
        !organizationData.assignedRouteId ||
        !organizationData.assignedBusId
      ) {
        Alert.alert(
          "Missing Data",
          "Your driver profile is missing an assigned route or bus. Please contact your admin.",
        );
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/trips/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeId: organizationData.assignedRouteId,
          busId: organizationData.assignedBusId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const tripId: number = data.trip.TripId;
        const routeId: number = organizationData.assignedRouteId!;
        setIsTripStarted(true);
        setActiveTripId(tripId);

        // ΓöÇΓöÇ GPS TRACKING ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required for live tracking. Students won't see your position.",
          );
        } else {
          // Start watching GPS position every 5 seconds
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000, // ms between updates
              distanceInterval: 5, // meters minimum movement
            },
            async (locationResult) => {
              const { latitude, longitude } = locationResult.coords;
              const currentToken = await AsyncStorage.getItem("authToken");

              //Emit via Socket.IO for instant broadcast + DB persistence (handled in app.ts)
              try {
                const base64Url = (currentToken || "").split(".")[1] || "";
                const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                const jwtPayload = JSON.parse(atob(base64));
                const driverId: number = jwtPayload?.userId ?? 0;
                emitLocationUpdate({
                  tripId,
                  routeId,
                  latitude,
                  longitude,
                  driverId,
                });
              } catch {
                emitLocationUpdate({
                  tripId,
                  routeId,
                  latitude,
                  longitude,
                  driverId: 0,
                });
              }

              // 2∩╕ÅΓâú Also POST to backend so location is persisted in DB
              try {
                await fetch(`${API_BASE_URL}/api/trips/location`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`,
                  },
                  body: JSON.stringify({ tripId, latitude, longitude }),
                });
              } catch (err) {
                console.warn("[GPS] Failed to POST location:", err);
              }
            },
          );
          locationWatchRef.current = subscription;
          setIsGpsActive(true);
        }
        // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

        Alert.alert("Success", "Trip started! Students are being notified.");
      } else {
        Alert.alert("Error", data.message);
      }
    } catch {
      Alert.alert("Error", "Failed to start trip");
    }
  };

  const handleEndTrip = async () => {
    try {
      // ΓöÇΓöÇ STOP GPS TRACKING ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
      setIsGpsActive(false);
      // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/api/trips/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tripId: activeTripId }),
      });
      if (res.ok) {
        setIsTripStarted(false);
        setActiveTripId(null);
        Alert.alert("Success", "Trip ended successfully.");
      }
    } catch {
      Alert.alert("Error", "Failed to end trip");
    }
  };

  // Cleanup GPS watch if component unmounts while trip is active
  useEffect(() => {
    return () => {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
    };
  }, []);

  const quickActions = [
    { id: 1, name: "Driver", icon: "car" as const, color: "#5FA3E3BD" },
    { id: 2, name: "Student", icon: "school" as const, color: "#5FA3E3BD" },
    { id: 3, name: "Parent", icon: "people" as const, color: "#5FA3E3BD" },
    { id: 4, name: "Schedule", icon: "calendar" as const, color: "#5FA3E3BD" },
    { id: 5, name: "Fleet", icon: "bus" as const, color: "#5FA3E3BD" },
    { id: 6, name: "Payment", icon: "card" as const, color: "#5FA3E3BD" },
    { id: 7, name: "Notice", icon: "megaphone" as const, color: "#5FA3E3BD" },
    {
      id: 8,
      name: "Trip Log",
      icon: "document-text" as const,
      color: "#5FA3E3BD",
    },
    { id: 9, name: "Pay Log", icon: "cash" as const, color: "#5FA3E3BD" },
  ];

  const handleQuickAction = (actionName: string) => {
    console.log(`${actionName} action pressed`);
    switch (actionName) {
      case "Driver":
        router.push("/driver");
        break;
      case "Student":
        router.push({ pathname: "/people", params: { tab: "students" } });
        break;
      case "Parent":
        router.push({ pathname: "/people", params: { tab: "parents" } });
        break;
      case "Schedule":
        router.push("/schedule");
        break;
      case "Fleet":
        router.push("/fleetdashboard");
        break;
      case "Payment":
        router.push("/payment");
        break;
      case "Notice":
        setShowNoticeModal(true);
        break;
      case "Trip Log":
        generateReport("trips");
        break;
      case "Pay Log":
        generateReport("payments");
        break;
      default:
        console.warn(`No route defined for action: ${actionName}`);
    }
  };

  const generateReport = async (type: "trips" | "payments") => {
    try {
      setReportType(type);
      setIsFetchingReport(true);
      setShowReportModal(true);

      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        setShowReportModal(false);
        return;
      }

      const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
      const url = `${API_BASE_URL}/api/reports/${type}?token=${cleanToken}&format=json`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setReportData(data.data);
      } else {
        Alert.alert("Error", data.message || "Failed to fetch report data");
        setShowReportModal(false);
      }
    } catch (err) {
      console.error("Report fetching error:", err);
      Alert.alert("Error", "Failed to connect to report service");
      setShowReportModal(false);
    } finally {
      setIsFetchingReport(false);
    }
  };

  const exportReport = async (format: "pdf" | "csv") => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const cleanToken = token?.startsWith("Bearer ") ? token.slice(7) : token;
      const url = `${API_BASE_URL}/api/reports/${reportType}?token=${cleanToken}&format=${format}`;
      Linking.openURL(url);
    } catch (err) {
      Alert.alert("Error", "Failed to open export link");
    }
  };

  const handleSendNotice = async () => {
    if (!noticeHeader.trim() || !noticeMessage.trim()) {
      Alert.alert("Error", "Please fill in both the header and the message");
      return;
    }

    try {
      setIsSendingNotice(true);
      const token = await AsyncStorage.getItem("authToken");
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

      const res = await fetch(`${apiBaseUrl}/api/users/send-notice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          header: noticeHeader,
          message: noticeMessage,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Close modal first before showing alert
        setShowNoticeModal(false);
        setNoticeHeader("");
        setNoticeMessage("");
        setIsSendingNotice(false);

        // Show success alert after modal is closed
        setTimeout(() => {
          Alert.alert("Success", "Notice sent to everyone!");
        }, 300);
      } else {
        setIsSendingNotice(false);
        Alert.alert("Error", data.message || "Failed to send notice");
      }
    } catch (error) {
      setIsSendingNotice(false);
      console.error("Error sending notice:", error);
      Alert.alert("Error", "Connection error");
    }
  };

  if (loading) {
    return (
      <SafeAreaView testID="dashboardScreen" style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (organizationData.role?.toLowerCase() === "driver") {
    return (
      <SafeAreaView testID="dashboardScreen" style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Premium Driver Pass Header */}
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => router.push("/DriverProfile")}
          >
            <LinearGradient
              colors={["#0F172A", "#1E293B"]}
              style={styles.idCardContainer}
            >
              <View style={styles.idCardDecor} />

              <View style={styles.idCardHeader}>
                <View style={styles.logoContainer}>
                  <Image
                    source={organizationData.logo}
                    style={styles.idLogo}
                    resizeMode="cover"
                    onError={(e) => {
                      console.log(
                        "[Dashboard] Driver logo load error:",
                        e.nativeEvent.error,
                      );
                      setOrganizationData((prev) => ({
                        ...prev,
                        logo: require("../assets/images/logo.png"),
                      }));
                    }}
                  />
                </View>

                <TouchableOpacity
                  style={styles.notificationBell}
                  onPress={handleNotificationPress}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="#64748B"
                  />
                  {hasUnreadNotifications && <View style={styles.bellBadge} />}
                </TouchableOpacity>
              </View>

              <View style={styles.idCardBody}>
                <View style={styles.nameSection}>
                  <Text style={[styles.idRoleLabel, { color: "#4FA3FF" }]}>
                    PROFESSIONAL DRIVER PASS
                  </Text>
                  <Text style={styles.idNameValue}>
                    {organizationData.name}
                  </Text>
                  <View style={styles.emailContainer}>
                    <Ionicons
                      name="mail-outline"
                      size={12}
                      color="#3B82F6"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.idEmailValue, { color: "#64748B" }]}>
                      {organizationData.email}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>ASSIGNED ROUTE</Text>
                    <Text style={styles.statValue}>
                      {organizationData.routeName || "N/A"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                    ]}
                  />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>VEHICLE</Text>
                    <Text style={styles.statValue}>
                      {organizationData.busNumber || "N/A"}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Trip Control Section */}
          <View style={styles.tripControlSection}>
            <Text style={styles.sectionTitle}>Trip Control</Text>
            <TouchableOpacity
              style={[
                styles.tripBtn,
                isTripStarted ? styles.endTripBtn : styles.startTripBtn,
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

            {/* GPS Active Indicator */}
            {isTripStarted && (
              <View style={styles.gpsStatusRow}>
                <View
                  style={[
                    styles.gpsDot,
                    { backgroundColor: isGpsActive ? "#22c55e" : "#f59e0b" },
                  ]}
                />
                <Text
                  style={[
                    styles.gpsStatusText,
                    { color: isGpsActive ? "#22c55e" : "#f59e0b" },
                  ]}
                >
                  {isGpsActive
                    ? "GPS Active - Students can see your location"
                    : "Waiting for GPS permission..."}
                </Text>
              </View>
            )}

            <Text style={styles.tripHint}>
              {isTripStarted
                ? "Tracking is live. Students can see you now."
                : "Click start to begin tracking for students."}
            </Text>
          </View>
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  }

  if (organizationData.role?.toLowerCase() === "parent") {
    return (
      <SafeAreaView testID="dashboardScreen" style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Premium Family Pass Header */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/myprofile")}
          >
            <LinearGradient
              colors={["#0F172A", "#1E293B"]}
              style={styles.idCardContainer}
            >
              <View style={styles.idCardDecor} />

              <View style={styles.idCardHeader}>
                <View style={styles.logoContainer}>
                  <Image
                    source={organizationData.logo}
                    style={styles.idLogo}
                    resizeMode="cover"
                    onError={(e) => {
                      console.log(
                        "[Dashboard] Parent logo load error:",
                        e.nativeEvent.error,
                      );
                      setOrganizationData((prev) => ({
                        ...prev,
                        logo: require("../assets/images/logo.png"),
                      }));
                    }}
                  />
                </View>

                <TouchableOpacity
                  style={styles.notificationBell}
                  onPress={() => router.push("/notifications")}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="#64748B"
                  />
                  <View style={styles.bellBadge} />
                </TouchableOpacity>
              </View>

              <View style={styles.idCardBody}>
                <View style={styles.nameSection}>
                  <Text style={[styles.idRoleLabel, { color: "#3B82F6" }]}>
                    FAMILY PASS & OVERSIGHT
                  </Text>
                  <Text style={styles.idNameValue}>
                    {organizationData.name}
                  </Text>
                  <View style={styles.emailContainer}>
                    <Ionicons
                      name="people-outline"
                      size={12}
                      color="#3B82F6"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.idEmailValue, { color: "#64748B" }]}>
                      Family Overview
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>CHILD</Text>
                    <Text style={styles.statValue}>
                      {organizationData.children &&
                      organizationData.children.length > 0
                        ? organizationData.children[0].name
                        : "No Student Added"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                    ]}
                  />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>PRIMARY ROUTE</Text>
                    <Text style={styles.statValue}>
                      {organizationData.children &&
                      organizationData.children.length > 0
                        ? organizationData.children[0].routeName ||
                          "Not Assigned"
                        : "N/A"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                    ]}
                  />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>BUS</Text>
                    <Text style={styles.statValue}>
                      {organizationData.children &&
                      organizationData.children.length > 0
                        ? organizationData.children[0].busNumber || "N/A"
                        : "N/A"}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statsRow,
                    {
                      marginTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.1)",
                      paddingTop: 10,
                    },
                  ]}
                >
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>DRIVER</Text>
                    <Text style={styles.statValue}>
                      {organizationData.children &&
                      organizationData.children.length > 0
                        ? organizationData.children[0].driverName ||
                          "Assigning..."
                        : "N/A"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                    ]}
                  />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>CONTACT</Text>
                    <Text style={styles.statValue}>
                      {organizationData.children &&
                      organizationData.children.length > 0
                        ? organizationData.children[0].driverPhone || "N/A"
                        : "N/A"}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Track My Bus Button ΓÇö Parent (uses first child's route) */}
          {(() => {
            const childRouteId =
              organizationData.children && organizationData.children.length > 0
                ? ((organizationData.children[0] as any).routeId ??
                  (organizationData.children[0] as any).RouteId ??
                  null)
                : null;
            return childRouteId ? (
              <TouchableOpacity
                style={styles.trackBusBtn}
                activeOpacity={0.85}
                onPress={() => router.push(`/map?routeId=${childRouteId}`)}
              >
                <LinearGradient
                  colors={["#165C9C", "#4FA3FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.trackBusBtnInner}
                >
                  <Ionicons name="navigate" size={22} color="#FFF" />
                  <Text style={styles.trackBusBtnText}>
                    {"Track Child's Bus Live"}
                  </Text>
                  <View style={styles.trackBusLiveDot} />
                </LinearGradient>
              </TouchableOpacity>
            ) : null;
          })()}

          {/* Billing Overview Section */}
          <View style={styles.billingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Billing & Payments</Text>
              <TouchableOpacity onPress={() => router.push("/payment")}>
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
                  <Text style={styles.billValue}>
                    Rs. {balanceDue.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>Next Due</Text>
                  <Text style={styles.billValue}>{nextDueDate}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => router.push("/payment")}
              >
                <Text style={styles.payBtnText}>Pay Now</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Quick Info Section removed (Family Activity) */}
        </ScrollView>
        <Navigation />
      </SafeAreaView>
    );
  }

  if (organizationData.role?.toLowerCase() === "student") {
    return (
      <SafeAreaView testID="dashboardScreen" style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Premium Student Pass Header */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowProfileModal(true)}
          >
            <LinearGradient
              colors={["#0F172A", "#1E293B"]}
              style={styles.idCardContainer}
            >
              <View style={styles.idCardDecor} />

              <View style={styles.idCardHeader}>
                <View style={styles.logoContainer}>
                  <Image
                    source={organizationData.logo}
                    style={styles.idLogo}
                    resizeMode="cover"
                    onError={(e) => {
                      console.log(
                        "[Dashboard] Student logo load error:",
                        e.nativeEvent.error,
                      );
                      setOrganizationData((prev) => ({
                        ...prev,
                        logo: require("../assets/images/logo.png"),
                      }));
                    }}
                  />
                </View>

                <TouchableOpacity
                  style={styles.notificationBell}
                  onPress={() => router.push("/notifications")}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="#64748B"
                  />
                  <View style={styles.bellBadge} />
                </TouchableOpacity>
              </View>

              <View style={styles.idCardBody}>
                <View style={styles.nameSection}>
                  <Text style={styles.idRoleLabel}>DIGITAL STUDENT PASS</Text>
                  <Text style={styles.idNameValue}>
                    {organizationData.name}
                  </Text>
                  <View style={styles.emailContainer}>
                    <Ionicons
                      name="mail-outline"
                      size={12}
                      color="#3B82F6"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.idEmailValue}>
                      {organizationData.email}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>ROUTE</Text>
                    <Text style={styles.statValue}>
                      {organizationData.routeName || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>DRIVER</Text>
                    <Text style={styles.statValue}>
                      {organizationData.driverName || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>BUS</Text>
                    <Text style={styles.statValue}>
                      {organizationData.busNumber || "N/A"}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statsRow,
                    {
                      marginTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.1)",
                      paddingTop: 10,
                    },
                  ]}
                >
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>CONTACT</Text>
                    <Text style={styles.statValue}>
                      {organizationData.driverPhone || "N/A"}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Track My Bus Button ΓÇö Student (always visible; map resolves route from DB) */}
          <TouchableOpacity
            style={styles.trackBusBtn}
            activeOpacity={0.85}
            onPress={() =>
              organizationData.assignedRouteId
                ? router.push(
                    `/map?routeId=${organizationData.assignedRouteId}`,
                  )
                : router.push("/map")
            }
          >
            <LinearGradient
              colors={["#165C9C", "#4FA3FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.trackBusBtnInner}
            >
              <Ionicons name="navigate" size={22} color="#FFF" />
              <Text style={styles.trackBusBtnText}>Track My Bus Live</Text>
              <View style={styles.trackBusLiveDot} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Bus Deployment Section with consistent styling */}
          <View style={styles.attendanceContainer}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.atTitle}>Bus Start Schedule</Text>
                <Text style={styles.atSubtitle}>
                  Check daily departure times
                </Text>
              </View>
              <View style={styles.atYearBtn}>
                <Text style={styles.atYearText}>
                  {new Date().toLocaleString("default", { month: "short" })}{" "}
                  {new Date().getFullYear()}
                </Text>
              </View>
            </View>
            <View style={styles.simpleCalendar}>
              <View style={styles.weekRow}>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <View key={i} style={styles.dayCol}>
                    <Text style={styles.dayLabel}>{d}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {(() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const today = now.getDate();

                  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
                  // Our week row starts with Monday
                  const paddingDays =
                    firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                  const daysInMonth = new Date(year, month + 1, 0).getDate();

                  const cells = [];
                  // Add empty padding cells
                  for (let p = 0; p < paddingDays; p++) {
                    cells.push(
                      <View key={`pad-${p}`} style={styles.dayCell} />,
                    );
                  }

                  // Add day cells
                  for (let day = 1; day <= daysInMonth; day++) {
                    const isToday = day === today;
                    const date = new Date(year, month, day);
                    const dayNamesShort = [
                      "Sun",
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                    ];
                    const currentDayName = dayNamesShort[date.getDay()];

                    const activeDays =
                      organizationData.scheduleDays === "Daily"
                        ? dayNamesShort
                        : organizationData.scheduleDays
                            ?.split(",")
                            .map((d) => d.trim()) || [
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                          ];

                    const hasStartTime = activeDays.includes(currentDayName);

                    cells.push(
                      <View
                        key={`day-${day}`}
                        style={[styles.dayCell, isToday && styles.todayCell]}
                      >
                        <Text
                          style={[styles.dayText, isToday && styles.todayText]}
                        >
                          {day}
                        </Text>
                        {hasStartTime && (
                          <Text
                            style={[
                              styles.startTimeLabel,
                              isToday && styles.todayStartTime,
                            ]}
                          >
                            {formatTimeStr(
                              organizationData.startTime || "07:30",
                            )}
                          </Text>
                        )}
                      </View>,
                    );
                  }
                  return cells;
                })()}
              </View>
            </View>
          </View>
        </ScrollView>
        <Navigation />

        <StudentProfileModal
          visible={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          studentData={{
            name: organizationData.name,
            email: organizationData.email,
            routeName: organizationData.routeName,
            driverName: organizationData.driverName,
            busNumber: organizationData.busNumber,
            driverPhone: organizationData.driverPhone,
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="dashboardScreen" style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
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
              onPress={handleNotificationPress}
            >
              <Ionicons name="notifications-outline" size={22} color="#666" />
              {hasUnreadNotifications && <View style={styles.bellBadge} />}
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
          <Text style={styles.sectionTitle}>{"Today's Trip Schedule"}</Text>

          {tripSchedule.length > 0 ? (
            <View style={styles.scheduleTable}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <View style={styles.tableCellLeft}>
                  <Text style={styles.tableHeaderText}>Route</Text>
                </View>
                <View style={styles.tableCellRight}>
                  <Text style={styles.tableHeaderText}>Time</Text>
                </View>
              </View>

              {/* Table Rows */}
              {tripSchedule.map((trip, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.tableCellLeft}>
                    <Text style={styles.tableCell}>{trip.route}</Text>
                  </View>
                  <View style={styles.tableCellRight}>
                    <Text style={styles.tableCell}>{trip.time}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noScheduleContainer}>
              <Text style={styles.noScheduleText}>
                No trips scheduled for today
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Send New Notice Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNoticeModal}
        onRequestClose={() => setShowNoticeModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send New Notice</Text>
              <TouchableOpacity onPress={() => setShowNoticeModal(false)}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Notice Header (Title)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Weather Alert, Schedule Change"
              value={noticeHeader}
              onChangeText={setNoticeHeader}
              placeholderTextColor="#B0BCC4"
            />

            <Text style={styles.label}>Message Text</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Type your notice message here..."
              multiline
              numberOfLines={4}
              value={noticeMessage}
              onChangeText={setNoticeMessage}
              placeholderTextColor="#B0BCC4"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                isSendingNotice && styles.disabledButton,
              ]}
              onPress={handleSendNotice}
              disabled={isSendingNotice}
            >
              {isSendingNotice ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.sendButtonText}>Send to All Users</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report Viewer Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { flex: 0.9 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {reportType === "trips" ? "Trip Logs" : "Payment Records"}
              </Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isFetchingReport ? (
              <ActivityIndicator
                size="large"
                color="#4FA3FF"
                style={{ flex: 1 }}
              />
            ) : (
              <>
                <View style={styles.exportOptions}>
                  <Text style={styles.exportLabel}>Export as:</Text>
                  <View style={styles.exportRow}>
                    <TouchableOpacity
                      style={[styles.exportBtn, { backgroundColor: "#F43F5E" }]}
                      onPress={() => exportReport("pdf")}
                    >
                      <Ionicons name="document-text" size={18} color="#FFF" />
                      <Text style={styles.exportBtnText}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.exportBtn, { backgroundColor: "#10B981" }]}
                      onPress={() => exportReport("csv")}
                    >
                      <Ionicons name="grid" size={18} color="#FFF" />
                      <Text style={styles.exportBtnText}>CSV / Excel</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View>
                    <ScrollView showsVerticalScrollIndicator={true}>
                      <View style={styles.reportTable}>
                        <View style={styles.reportTableHead}>
                          {reportType === "trips" ? (
                            <>
                              <Text style={[styles.reportTh, { width: 40 }]}>
                                #
                              </Text>
                              <Text style={[styles.reportTh, { width: 100 }]}>
                                Date
                              </Text>
                              <Text style={[styles.reportTh, { width: 80 }]}>
                                Start
                              </Text>
                              <Text style={[styles.reportTh, { width: 80 }]}>
                                End
                              </Text>
                              <Text style={[styles.reportTh, { width: 120 }]}>
                                Route
                              </Text>
                              <Text style={[styles.reportTh, { width: 100 }]}>
                                Bus
                              </Text>
                              <Text style={[styles.reportTh, { width: 120 }]}>
                                Driver
                              </Text>
                              <Text style={[styles.reportTh, { width: 80 }]}>
                                Status
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.reportTh, { width: 40 }]}>
                                #
                              </Text>
                              <Text style={[styles.reportTh, { width: 100 }]}>
                                Date
                              </Text>
                              <Text style={[styles.reportTh, { width: 150 }]}>
                                Student
                              </Text>
                              <Text style={[styles.reportTh, { width: 150 }]}>
                                Parent
                              </Text>
                              <Text style={[styles.reportTh, { width: 100 }]}>
                                Method
                              </Text>
                              <Text style={[styles.reportTh, { width: 100 }]}>
                                Amount
                              </Text>
                            </>
                          )}
                        </View>
                        {reportData.map((item, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.reportTableRow,
                              idx % 2 === 0 && { backgroundColor: "#F8FAFC" },
                            ]}
                          >
                            {reportType === "trips" ? (
                              <>
                                <Text style={[styles.reportTd, { width: 40 }]}>
                                  {item.sn}
                                </Text>
                                <Text style={[styles.reportTd, { width: 100 }]}>
                                  {item.date}
                                </Text>
                                <Text style={[styles.reportTd, { width: 80 }]}>
                                  {item.start}
                                </Text>
                                <Text style={[styles.reportTd, { width: 80 }]}>
                                  {item.end}
                                </Text>
                                <Text style={[styles.reportTd, { width: 120 }]}>
                                  {item.route}
                                </Text>
                                <Text style={[styles.reportTd, { width: 100 }]}>
                                  {item.bus}
                                </Text>
                                <Text style={[styles.reportTd, { width: 120 }]}>
                                  {item.driver}
                                </Text>
                                <Text
                                  style={[
                                    styles.reportTd,
                                    { width: 80, fontWeight: "bold" },
                                  ]}
                                >
                                  {item.status}
                                </Text>
                              </>
                            ) : (
                              <>
                                <Text style={[styles.reportTd, { width: 40 }]}>
                                  {item.sn}
                                </Text>
                                <Text style={[styles.reportTd, { width: 100 }]}>
                                  {item.date}
                                </Text>
                                <Text style={[styles.reportTd, { width: 150 }]}>
                                  {item.student}
                                </Text>
                                <Text style={[styles.reportTd, { width: 150 }]}>
                                  {item.parent}
                                </Text>
                                <Text style={[styles.reportTd, { width: 100 }]}>
                                  {item.method}
                                </Text>
                                <Text
                                  style={[
                                    styles.reportTd,
                                    { width: 100, fontWeight: "bold" },
                                  ]}
                                >
                                  Rs {item.amount}
                                </Text>
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

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
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 4,
    shadowColor: "#5FA3E3BD",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },

  idLogo: {
    width: "100%",
    height: "100%",
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
  /* Family Activity styles removed */
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
  // GPS active indicator
  gpsStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 8,
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gpsStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Track My Bus button
  trackBusBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#165C9C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  trackBusBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  trackBusBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  trackBusLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  pickupCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  pickupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  pickupLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
  },
  pickupValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 2,
  },
  pickupTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  pickupTimeText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  scheduleTable: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#728dbb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#759bcd",
  },
  tableHeaderText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E3A5F",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
  },
  tableCellLeft: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: "#9CA3AF",
  },
  tableCellRight: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tableCell: {
    fontSize: 14,
    color: "#333",
  },
  noScheduleContainer: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  noScheduleText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: "#1E293B",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  sendButton: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Report Table Styles
  exportOptions: {
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  exportLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  exportRow: {
    flexDirection: "row",
    gap: 12,
  },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  exportBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  reportTable: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
  },
  reportTableHead: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  reportTh: {
    padding: 12,
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
  },
  reportTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFF",
  },
  reportTd: {
    padding: 12,
    fontSize: 12,
    color: "#1E293B",
  },
});
