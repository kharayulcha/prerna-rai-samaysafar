import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RouteItem {
  id: string;
  name: string;
  time: string;
  days: string;
}

export default function Schedule() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [studentSchedule, setStudentSchedule] = useState<any[]>([]);
  const [assignedRouteInfo, setAssignedRouteInfo] = useState<any>(null);


  // Form State
  const [name, setName] = useState("");
  const [time, setTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const getStoredToken = useCallback(async () => {
    return await AsyncStorage.getItem("authToken");
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const rawToken = await getStoredToken();
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getStoredToken]);

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

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getStoredToken();
      if (!token) return;
      const decoded = decodeJWT(token);
      const role = (decoded?.role || decoded?.Role || "user").toLowerCase();
      setUserRole(role);

      const authHeaders = await getAuthHeaders();

      if (role === "student") {
        const res = await fetch(`${API_BASE_URL}/api/routes/student-schedule/view`, {
          headers: { ...authHeaders },
        });
        const data = await res.json();
        if (data.schedule) {
          setStudentSchedule(data.schedule);
          setAssignedRouteInfo({
            name: data.routeName,
            driver: data.driver,
            bus: data.bus,
            startTime: data.startTime
          });
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
          headers: { ...authHeaders },
        });
        const data = await res.json();

        const mapped: RouteItem[] = (data.routes || []).map((r: any) => ({
          id: r.RouteId?.toString() ?? Math.random().toString(),
          name: r.Name,
          time: r.StartTime,
          days: r.ScheduleDays,
        }));
        setRoutes(mapped);
      }
    } catch (error) {
      console.error("Fetch schedule error:", error);
      Alert.alert("Error", "Failed to fetch schedule");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, getStoredToken, decodeJWT]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      // Sort days based on standard week order
      const newDays = [...selectedDays, day];
      newDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
      setSelectedDays(newDays);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const parseTimeString = (timeStr: string) => {
    try {
      // Expect "07:00 AM" format
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const date = new Date();
      date.setHours(hours);
      date.setMinutes(minutes);
      return date;
    } catch {
      return new Date();
    }
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setSelectedRouteId(null);
    setName("");
    setTime(new Date());
    setSelectedDays([]);
    setModalVisible(true);
  };

  const handleOpenEdit = (item: RouteItem) => {
    setIsEditMode(true);
    setSelectedRouteId(item.id);
    setName(item.name);
    setTime(parseTimeString(item.time));

    if (item.days === "Daily") {
      setSelectedDays([...DAYS]);
    } else {
      setSelectedDays(item.days.split(',').map(d => d.trim()));
    }

    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      if (!name || selectedDays.length === 0) {
        Alert.alert("Missing details", "Please enter a name and select at least one day.");
        return;
      }

      const authHeaders = await getAuthHeaders();
      const orgId = await getOrgIdFromToken();
      if (!orgId) {
        Alert.alert("Error", "Organization ID missing. Please login again.");
        return;
      }

      const daysString = selectedDays.length === 7 ? "Daily" : selectedDays.join(",");
      const timeString = formatTime(time);

      let url = `${API_BASE_URL}/api/routes/create-route`;
      let method = "POST";
      let body: any = {
        name: name,
        startTime: timeString,
        scheduleDays: daysString,
        busIds: [],
        driverIds: []
      };

      if (isEditMode && selectedRouteId) {
        url = `${API_BASE_URL}/api/routes/${selectedRouteId}`;
        method = "PUT";
        // Convert to payload that matches what controller expects (omitting bus/driver so they don't get wiped)
        body = {
          name: name,
          startTime: timeString,
          scheduleDays: daysString,
        };
      }

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save route");
      }

      Alert.alert("Success", `Route ${isEditMode ? 'updated' : 'added'} successfully`);
      setModalVisible(false);
      fetchRoutes();
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to save route");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this route?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const authHeaders = await getAuthHeaders();
              const res = await fetch(`${API_BASE_URL}/api/routes/${id}`, {
                method: "DELETE",
                headers: { ...authHeaders },
              });
              if (!res.ok) throw new Error("Failed to delete");
              Alert.alert("Success", "Route deleted");
              fetchRoutes();
            } catch (error) {
              Alert.alert("Error", "Could not delete route");
            }
          }
        }
      ]
    );
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
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>Manage your trip schedules</Text>
        </View>
        {(userRole !== "student" && userRole !== "parent") && (
          <TouchableOpacity style={styles.addButton} onPress={handleOpenAdd}>
            <Text style={styles.addButtonText}>Add Route</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        </View>
      ) : userRole === "student" ? (
        <FlatList
          data={studentSchedule}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            assignedRouteInfo && (
              <View style={styles.assignedRouteCard}>
                <View style={styles.routeHeader}>
                  <Ionicons name="trail-sign" size={24} color={PRIMARY_BLUE} />
                  <Text style={styles.assignedRouteName}>{assignedRouteInfo.name}</Text>
                </View>
                <View style={styles.routeDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="person" size={16} color="#666" />
                    <Text style={styles.detailText}>Driver: {assignedRouteInfo.driver}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="bus" size={16} color="#666" />
                    <Text style={styles.detailText}>Bus: {assignedRouteInfo.bus}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.detailText}>Default Start: {assignedRouteInfo.startTime}</Text>
                  </View>
                </View>
              </View>
            )
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No assigned route schedule found.</Text>}
          renderItem={({ item }) => (
            <View style={styles.scheduleItem}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{item.day}</Text>
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleTime}>{item.time}</Text>
                <Text style={styles.scheduleLabel}>Regular Trip</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No routes found.</Text>}
          renderItem={({ item }) => (
            <View style={styles.routeCard}>
              <View style={styles.cardContentContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>{item.name}</Text>
                  <Text style={styles.routeTime}>{item.time}</Text>
                  <Text style={styles.routeDays}>{item.days}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color={PRIMARY_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color="#FF4F4F" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEditMode ? "Edit Route" : "Add New Route"}</Text>

            <Text style={styles.label}>Route Name</Text>
            <TextInput
              placeholder="e.g. Morning Pickup"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Start Time</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.timeButtonText}>{formatTime(time)}</Text>
              <Ionicons name="time-outline" size={20} color="#666" />
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) setTime(selectedDate);
                }}
              />
            )}

            <Text style={styles.label}>Days</Text>
            <View style={styles.daysContainer}>
              {DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>{isEditMode ? "Update" : "Save"}</Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  routeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardContentContainer: {
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
    fontSize: 16,
    color: PRIMARY_BLUE,
    fontWeight: "bold",
  },
  routeInfo: {
    flex: 1
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12
  },
  actionBtn: {
    padding: 6
  },
  routeName: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  routeTime: {
    marginTop: 6,
    fontSize: 13,
    color: "#666",
  },
  routeDays: {
    marginTop: 2,
    fontSize: 12,
    color: "#888",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: DEEP_BLUE
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9'
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9f9f9'
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333'
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  dayChipSelected: {
    backgroundColor: PRIMARY_BLUE,
    borderColor: PRIMARY_BLUE
  },
  dayText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500'
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '600'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 20
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center'
  },
  saveBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: PRIMARY_BLUE,
    alignItems: 'center'
  },
  cancelText: {
    color: '#666',
    fontWeight: '600'
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  assignedRouteCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 12,
  },
  assignedRouteName: {
    fontSize: 18,
    fontWeight: "bold",
    color: DEEP_BLUE,
  },
  routeDetails: {
    gap: 10,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#444",
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  dayBadgeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: PRIMARY_BLUE,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  scheduleLabel: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  }
});
