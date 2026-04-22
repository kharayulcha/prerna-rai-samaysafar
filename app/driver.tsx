import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface DriverItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  route: string;
  routeId?: number;
  busId?: number;
  busNumber?: string;
}

interface RouteItem {
  id: number;
  name: string;
}

interface BusItem {
  id: string;
  number: string;
  driver: string;
  route: string;
}

interface TokenPayload {
  OrgId?: number;
  orgId?: number;
  organizationId?: number;
  role?: string;
  Role?: string;
  isAdmin?: boolean;
  IsAdmin?: boolean;
  admin?: boolean;
  userRole?: string;
  roleId?: number;
  RoleId?: number;
  UserRole?: string;
  userType?: string;
  UserType?: string;
  roleName?: string;
  RoleName?: string;
}

export default function Driver() {
  const [activeTab, setActiveTab] = useState<"drivers" | "buses">("drivers");
  const [query, setQuery] = useState("");
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [buses, setBuses] = useState<BusItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [loadingBuses, setLoadingBuses] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [driverForm, setDriverForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    routeId: "",
    busId: "",
  });

  const [busForm, setBusForm] = useState({
    busNumber: "",
    model: "",
  });

  // Edit/Delete state
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingBus, setEditingBus] = useState<BusItem | null>(null);
  const [editingDriver, setEditingDriver] = useState<DriverItem | null>(null);

  const filteredDrivers = useMemo(() => {
    if (!query.trim()) return drivers;
    const q = query.toLowerCase();
    return drivers.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q),
    );
  }, [query, drivers]);

  const filteredBuses = useMemo(() => {
    if (!query.trim()) return buses;
    const q = query.toLowerCase();
    return buses.filter(
      (item) =>
        item.number.toLowerCase().includes(q) ||
        item.driver.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q),
    );
  }, [query, buses]);

  const openSearch = () => { }; // Removed search logic for consistency with People page
  const closeSearch = () => { };
  const closeAdd = () => {
    setAddVisible(false);
    setModalMode("add");
    setEditingBus(null);
    setEditingDriver(null);
    setBusForm({ busNumber: "", model: "" });
    setDriverForm({ name: "", email: "", phone: "", password: "", routeId: "", busId: "" });
  };

  const getStoredToken = useCallback(async () => {
    let token = await AsyncStorage.getItem("authToken");
    if (!token && typeof window !== "undefined" && window.localStorage) {
      token = window.localStorage.getItem("authToken");
    }
    return token;
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const rawToken = await getStoredToken();
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getStoredToken]);

  const decodeJWT = useCallback((token: string): TokenPayload | null => {
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
    } catch {
      return null;
    }
  }, []);

  const getOrgIdFromToken = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) return undefined;
    const decoded = decodeJWT(token);
    return decoded?.OrgId ?? decoded?.orgId ?? decoded?.organizationId;
  }, [decodeJWT, getStoredToken]);

  const getRoleFromToken = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) return undefined;
    const decoded = decodeJWT(token);
    return decoded?.role ?? decoded?.Role ?? decoded?.userRole;
  }, [decodeJWT, getStoredToken]);

  const isAdminFromToken = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) return false;
    const decoded = decodeJWT(token);
    const roleCandidates = [
      decoded?.role,
      decoded?.Role,
      decoded?.userRole,
      decoded?.UserRole,
      decoded?.userType,
      decoded?.UserType,
      decoded?.roleName,
      decoded?.RoleName,
    ]
      .filter((v) => v !== undefined && v !== null)
      .map((v) => String(v).toLowerCase());

    if (decoded?.roleId === 1 || decoded?.RoleId === 1) return true;

    if (roleCandidates.some((r) => r === "1")) return true;
    if (roleCandidates.some((r) => /admin|orgadmin|organization/.test(r))) {
      return true;
    }

    return !!(decoded?.isAdmin ?? decoded?.IsAdmin ?? decoded?.admin);
  }, [decodeJWT, getStoredToken]);
  const openAdd = async () => {
    const admin = await isAdminFromToken();
    setIsAdmin(admin);
    setAddVisible(true);
  };

  const refreshAdminStatus = useCallback(async () => {
    const admin = await isAdminFromToken();
    setIsAdmin(admin);
  }, [isAdminFromToken]);

  const fetchDrivers = useCallback(async () => {
    try {
      setLoadingDrivers(true);
      const authHeaders = await getAuthHeaders();
      const orgId = await getOrgIdFromToken();
      const url = orgId
        ? `${API_BASE_URL}/api/drivers/get-drivers?orgId=${orgId}`
        : `${API_BASE_URL}/api/drivers/get-drivers`;
      const res = await fetch(url, {
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : (data?.drivers ?? data?.Drivers ?? data?.data ?? []);
      const mapped: DriverItem[] = list.map((item: any) => ({
        id:
          item?.UserId?.toString() ??
          item?.userId?.toString() ??
          Math.random().toString(),
        name: item?.Name ?? item?.name ?? "Unknown",
        email: item?.Email ?? item?.email ?? "",
        phone: item?.Phone ?? item?.phone ?? "",
        route: item?.Route ?? item?.route ?? "",
        routeId: item?.RouteId ?? item?.routeId,
        busId: item?.BusId ?? item?.busId,
        busNumber: item?.BusNumber ?? item?.busNumber ?? "",
      }));
      setDrivers(mapped);
    } catch (error) {
      Alert.alert("Error", "Failed to load drivers.");
    } finally {
      setLoadingDrivers(false);
    }
  }, [getAuthHeaders, getOrgIdFromToken]);

  const fetchBuses = useCallback(async () => {
    try {
      setLoadingBuses(true);
      const authHeaders = await getAuthHeaders();
      const orgId = await getOrgIdFromToken();
      const url = orgId
        ? `${API_BASE_URL}/api/buses/get-buses?orgId=${orgId}`
        : `${API_BASE_URL}/api/buses/get-buses`;
      const res = await fetch(url, {
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : (data?.buses ?? data?.Buses ?? data?.data ?? []);
      const mapped: BusItem[] = list.map((item: any) => ({
        id:
          item?.BusId?.toString() ??
          item?.id?.toString() ??
          Math.random().toString(),
        number: item?.BusNumber ?? item?.number ?? "Unknown",
        driver: item?.DriverName ?? item?.driver ?? "N/A",
        route: item?.Model ?? item?.model ?? "N/A", // Model is stored in route field for display
      }));
      setBuses(mapped);
    } catch (error) {
      Alert.alert("Error", "Failed to load buses.");
    } finally {
      setLoadingBuses(false);
    }
  }, [getAuthHeaders, getOrgIdFromToken]);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoadingRoutes(true);
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      const list = data?.routes ?? [];
      const mapped: RouteItem[] = list.map((item: any) => ({
        id: item.RouteId,
        name: item.Name,
      }));
      setRoutes(mapped);
    } catch (error) {
      console.error("Error fetching routes:", error);
    } finally {
      setLoadingRoutes(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchDrivers();
    fetchBuses();
    fetchRoutes();
    refreshAdminStatus();
  }, [fetchBuses, fetchDrivers, fetchRoutes, refreshAdminStatus]);

  const handleAddDriver = async () => {
    console.log("Add Driver clicked");
    try {
      if (
        !driverForm.name ||
        !driverForm.email ||
        !driverForm.phone ||
        !driverForm.password
      ) {
        Alert.alert("Missing details", "Please fill all driver fields.");
        return;
      }

      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/drivers/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: driverForm.name,
          email: driverForm.email,
          phone: driverForm.phone,
          password: driverForm.password,
          routeId: driverForm.routeId ? Number(driverForm.routeId) : null,
          busId: driverForm.busId ? Number(driverForm.busId) : null,
          // role and orgId are handled by backend from token/defaults
        }),
      });

      console.log("Create driver response status:", res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error("Create driver failed:", text);
        try {
          const json = JSON.parse(text);
          throw new Error(json.message || "Failed to add driver");
        } catch (e) {
          throw new Error(text || "Failed to add driver");
        }
      }

      console.log("Create driver success");
      setDriverForm({ name: "", email: "", phone: "", password: "", routeId: "", busId: "" });
      closeAdd();
      fetchDrivers();
      Alert.alert("Success", "Driver created successfully");
    } catch (error: any) {
      console.error("Add driver error:", error);
      Alert.alert("Error", error?.message ?? "Failed to add driver.");
    }
  };

  const handleAddBus = async () => {
    try {
      if (!isAdmin) {
        Alert.alert("Access denied", "Only admin can add bus.");
        return;
      }
      if (!busForm.busNumber || !busForm.model) {
        Alert.alert("Missing details", "Please fill bus number and model.");
        return;
      }
      const orgId = await getOrgIdFromToken();
      if (!orgId) {
        Alert.alert("Missing organization", "Organization ID is required.");
        return;
      }
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/buses/add-bus`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          busNumber: busForm.busNumber,
          model: busForm.model,
          orgId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to add bus");
      }

      setBusForm({ busNumber: "", model: "" });
      closeAdd();
      fetchBuses();
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to add bus.");
    }
  };

  const handleEditBus = async () => {
    try {
      if (!isAdmin) {
        Alert.alert("Access denied", "Only admin can edit bus.");
        return;
      }
      if (!busForm.busNumber || !busForm.model) {
        Alert.alert("Missing details", "Please fill bus number and model.");
        return;
      }
      if (!editingBus) return;

      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/buses/${editingBus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          busNumber: busForm.busNumber,
          model: busForm.model,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update bus");
      }

      setBusForm({ busNumber: "", model: "" });
      setEditingBus(null);
      setModalMode("add");
      closeAdd();
      fetchBuses();
      Alert.alert("Success", "Bus updated successfully");
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to update bus.");
    }
  };

  const handleDeleteBus = async (busId: string) => {
    console.log("Delete Bus clicked for ID:", busId);
    try {
      if (!isAdmin) {
        console.warn("Delete Bus blocked: Not admin");
        Alert.alert("Access denied", "Only admin can delete bus.");
        return;
      }

      console.log("Showing delete confirmation for bus");
      Alert.alert(
        "Confirm Delete",
        "Are you sure you want to delete this bus?",
        [
          { text: "Cancel", style: "cancel", onPress: () => console.log("Delete Bus cancelled") },
          {
            text: "Delete",
            style: "default",
            onPress: async () => {
              console.log("Delete confirmed for bus:", busId);
              try {
                const authHeaders = await getAuthHeaders();
                const res = await fetch(`${API_BASE_URL}/api/buses/${busId}`, {
                  method: "DELETE",
                  headers: { ...authHeaders },
                });

                console.log("Delete bus status:", res.status);

                if (!res.ok) {
                  const text = await res.text();
                  console.error("Delete failed:", text);
                  throw new Error(text || "Failed to delete bus");
                }

                console.log("Delete bus success");
                fetchBuses();
                Alert.alert("Success", "Bus deleted successfully");
              } catch (error: any) {
                console.error("Delete handler error:", error);
                Alert.alert("Error", error?.message ?? "Failed to delete bus.");
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Delete wrapper error:", error);
      Alert.alert("Error", error?.message ?? "Failed to delete bus.");
    }
  };

  const handleEditDriver = async () => {
    try {
      if (!isAdmin) {
        Alert.alert("Access denied", "Only admin can edit driver.");
        return;
      }
      if (!driverForm.name || !driverForm.phone) {
        Alert.alert("Missing details", "Please fill name and phone.");
        return;
      }
      if (!editingDriver) return;

      const authHeaders = await getAuthHeaders();
      const body: any = {
        name: driverForm.name,
        phone: driverForm.phone,
        routeId: driverForm.routeId ? Number(driverForm.routeId) : null,
        busId: driverForm.busId ? Number(driverForm.busId) : null,
      };

      // Only include password if it's provided
      if (driverForm.password) {
        body.password = driverForm.password;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/drivers/${editingDriver.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update driver");
      }

      setDriverForm({ name: "", email: "", phone: "", password: "", routeId: "", busId: "" });
      setEditingDriver(null);
      setModalMode("add");
      closeAdd();
      fetchDrivers();
      Alert.alert("Success", "Driver updated successfully");
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to update driver.");
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    console.log("Delete Driver clicked for ID:", driverId);
    try {
      if (!isAdmin) {
        console.warn("Delete Driver blocked: Not admin");
        Alert.alert("Access denied", "Only admin can delete driver.");
        return;
      }

      console.log("Showing delete confirmation for driver");
      Alert.alert(
        "Confirm Delete",
        "Are you sure you want to delete this driver?",
        [
          { text: "Cancel", style: "cancel", onPress: () => console.log("Delete Driver cancelled") },
          {
            text: "Delete",
            style: "default",
            onPress: async () => {
              console.log("Delete confirmed for driver:", driverId);
              try {
                const authHeaders = await getAuthHeaders();
                const res = await fetch(
                  `${API_BASE_URL}/api/drivers/${driverId}`,
                  {
                    method: "DELETE",
                    headers: { ...authHeaders },
                  }
                );

                console.log("Delete driver status:", res.status);

                if (!res.ok) {
                  const text = await res.text();
                  console.error("Delete failed:", text);
                  throw new Error(text || "Failed to delete driver");
                }

                console.log("Delete driver success");
                fetchDrivers();
                Alert.alert("Success", "Driver deleted successfully");
              } catch (error: any) {
                console.error("Delete handler error:", error);
                Alert.alert(
                  "Error",
                  error?.message ?? "Failed to delete driver."
                );
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Delete wrapper error:", error);
      Alert.alert("Error", error?.message ?? "Failed to delete driver.");
    }
  };

  const openEditBus = (bus: BusItem) => {
    setModalMode("edit");
    setEditingBus(bus);
    setBusForm({ busNumber: bus.number, model: bus.route });
    setAddVisible(true);
  };

  const openEditDriver = (driver: DriverItem) => {
    setModalMode("edit");
    setEditingDriver(driver);
    setDriverForm({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      password: "", // Leave blank, only update if provided
      routeId: driver.routeId?.toString() ?? "",
      busId: driver.busId?.toString() ?? "",
    });
    setAddVisible(true);
  };

  const getInitials = (text: string) => {
    if (!text) return "";
    const parts = text.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return text.substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Driver</Text>
          <Text style={styles.subtitle}>Manage drivers and buses</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Text style={styles.addButtonText}>
            Add {activeTab === "drivers" ? "Driver" : "Bus"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "drivers" && styles.activeTab]}
          onPress={() => setActiveTab("drivers")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "drivers" && styles.activeTabText,
            ]}
          >
            Drivers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "buses" && styles.activeTab]}
          onPress={() => setActiveTab("buses")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "buses" && styles.activeTabText,
            ]}
          >
            Buses
          </Text>
        </TouchableOpacity>
      </View>

      {loadingDrivers || loadingBuses ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        </View>
      ) : activeTab === "drivers" ? (
        <FlatList
          data={filteredDrivers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No drivers found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.details}>{item.phone}</Text>
                  <View style={styles.assignmentDetails}>
                    {item.route ? (
                      <View style={[styles.tag, { backgroundColor: '#f0f7ff' }]}>
                        <Ionicons name="map" size={12} color={PRIMARY_BLUE} />
                        <Text style={styles.tagText}>R: {item.route}</Text>
                      </View>
                    ) : (
                      <View style={[styles.tag, { backgroundColor: '#f5f5f5' }]}>
                        <Ionicons name="map-outline" size={12} color="#999" />
                        <Text style={styles.tagText}>No Route Assigned</Text>
                      </View>
                    )}
                    {item.busNumber ? (
                      <View style={[styles.tag, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="bus" size={12} color="#3B82F6" />
                        <Text style={styles.tagText}>B: {item.busNumber}</Text>
                      </View>
                    ) : (
                      <View style={[styles.tag, { backgroundColor: '#f5f5f5' }]}>
                        <Ionicons name="bus-outline" size={12} color="#999" />
                        <Text style={styles.tagText}>No Bus Assigned</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {isAdmin && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => openEditDriver(item)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="pencil" size={20} color={PRIMARY_BLUE} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteDriver(item.id)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4F4F" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filteredBuses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No buses found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.number)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.number}</Text>
                  <Text style={styles.details}>Model: {item.route}</Text>
                  <View style={styles.assignmentDetails}>
                    <View style={[styles.tag, { backgroundColor: '#f0fff4' }]}>
                      <Ionicons name="person" size={12} color="#48BB78" />
                      <Text style={styles.tagText}>D: {item.driver}</Text>
                    </View>
                  </View>
                </View>
              </View>
              {isAdmin && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => openEditBus(item)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="pencil" size={20} color={PRIMARY_BLUE} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteBus(item.id)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4F4F" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addVisible}
        onRequestClose={closeAdd}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalMode === "edit" ? "Edit" : "Add New"} {activeTab === "drivers" ? "Driver" : "Bus"}
            </Text>

            {activeTab === "drivers" ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  placeholder="Ex: John Doe"
                  style={styles.input}
                  value={driverForm.name}
                  onChangeText={(v) => setDriverForm((p) => ({ ...p, name: v }))}
                />

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  placeholder="Ex: driver@example.com"
                  style={[styles.input, modalMode === "edit" && styles.disabledInput]}
                  value={driverForm.email}
                  onChangeText={(v) => setDriverForm((p) => ({ ...p, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={modalMode !== "edit"}
                />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  placeholder="Ex: +977 9800000000"
                  style={styles.input}
                  value={driverForm.phone}
                  onChangeText={(v) => setDriverForm((p) => ({ ...p, phone: v }))}
                  keyboardType="phone-pad"
                />

                <Text style={styles.label}>
                  {modalMode === "edit" ? "New Password (optional)" : "Password"}
                </Text>
                <TextInput
                  placeholder="Password"
                  style={styles.input}
                  value={driverForm.password}
                  onChangeText={(v) => setDriverForm((p) => ({ ...p, password: v }))}
                  secureTextEntry
                />

                <Text style={styles.label}>Assign Route</Text>
                <View style={styles.pickerWrapper}>
                  <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => {
                      Alert.alert(
                        "Select Route",
                        "Choose a primary route for this driver",
                        [
                          { text: "None", onPress: () => setDriverForm({ ...driverForm, routeId: "" }) },
                          ...routes.map(r => ({
                            text: r.name,
                            onPress: () => setDriverForm({ ...driverForm, routeId: r.id.toString() })
                          })),
                          { text: "Cancel", style: "cancel" }
                        ]
                      );
                    }}
                  >
                    <Text style={driverForm.routeId ? styles.pickerText : styles.pickerPlaceholder}>
                      {driverForm.routeId ? routes.find(r => r.id.toString() === driverForm.routeId)?.name : "Select Route"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Assign Bus</Text>
                <View style={styles.pickerWrapper}>
                  <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => {
                      Alert.alert(
                        "Select Bus",
                        "Choose a primary bus for this driver",
                        [
                          { text: "None", onPress: () => setDriverForm({ ...driverForm, busId: "" }) },
                          ...buses.map(b => ({
                            text: b.number,
                            onPress: () => setDriverForm({ ...driverForm, busId: b.id.toString() })
                          })),
                          { text: "Cancel", style: "cancel" }
                        ]
                      );
                    }}
                  >
                    <Text style={driverForm.busId ? styles.pickerText : styles.pickerPlaceholder}>
                      {driverForm.busId ? buses.find(b => b.id.toString() === driverForm.busId)?.number : "Select Bus"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeAdd}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={modalMode === "edit" ? handleEditDriver : handleAddDriver}
                  >
                    <Text style={styles.saveText}>
                      {modalMode === "edit" ? "Update Driver" : "Create Driver"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {!isAdmin && (
                  <Text style={styles.warningText}>Only admin can manage buses.</Text>
                )}

                <Text style={styles.label}>Bus Number</Text>
                <TextInput
                  placeholder="Ex: BAPA-1234"
                  style={styles.input}
                  value={busForm.busNumber}
                  onChangeText={(v) => setBusForm((p) => ({ ...p, busNumber: v }))}
                />

                <Text style={styles.label}>Model / Details</Text>
                <TextInput
                  placeholder="Ex: Tata Starbus"
                  style={styles.input}
                  value={busForm.model}
                  onChangeText={(v) => setBusForm((p) => ({ ...p, model: v }))}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeAdd}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !isAdmin && { opacity: 0.6 }]}
                    onPress={modalMode === "edit" ? handleEditBus : handleAddBus}
                    disabled={!isAdmin}
                  >
                    <Text style={styles.saveText}>
                      {modalMode === "edit" ? "Update Bus" : "Create Bus"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  addButton: {
    backgroundColor: PRIMARY_BLUE,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: PRIMARY_BLUE,
  },
  tabText: {
    fontSize: 16,
    color: "#999",
    fontWeight: "600",
  },
  activeTabText: {
    color: PRIMARY_BLUE,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e0f0ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    color: PRIMARY_BLUE,
    fontWeight: "bold",
  },
  info: {
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  details: {
    fontSize: 13,
    color: "#666",
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  actionBtn: {
    padding: 8
  },
  assignmentDetails: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap'
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    gap: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#333',
    fontWeight: '500'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: DEEP_BLUE,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
    marginBottom: 5,
  },
  disabledInput: {
    backgroundColor: "#f0f0f0",
    color: "#999",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: PRIMARY_BLUE,
    alignItems: 'center',
  },
  cancelText: {
    color: "#666",
    fontWeight: "600",
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    overflow: 'hidden'
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  pickerText: {
    fontSize: 16,
    color: '#333'
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#999'
  },
  warningText: {
    color: "#ff4f4f",
    fontSize: 12,
    marginBottom: 10,
    textAlign: "center",
  },
});
