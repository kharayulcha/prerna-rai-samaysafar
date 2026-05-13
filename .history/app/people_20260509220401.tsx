import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Navigation from "../components/navigation";

const PRIMARY_BLUE = "#4FA3FF";
const DEEP_BLUE = "#165C9C";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  parentId?: number | null;
  parentName?: string | null;
  routeId?: number | null;
  routeName?: string | null;
}

interface RouteItem {
  RouteId: number;
  Name: string;
}

export default function People() {
  const [activeTab, setActiveTab] = useState<"students" | "parents">("students");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    parentId: null as number | null,
    routeId: null as number | null,
  });

  const [availableParents, setAvailableParents] = useState<UserItem[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<RouteItem[]>([]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const s = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.phone.toLowerCase().includes(s)
      );
    });
  }, [users, search]);
    // Pagination ko calculator 
  const totalPages = Math.ceil(filteredUsers.length / 5) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * 5, currentPage * 5);

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
          .join("")
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

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = await getAuthHeaders();
      const role = activeTab === "students" ? "student" : "parent";
      const res = await fetch(`${API_BASE_URL}/api/users/list?role=${role}`, {
        headers: { ...authHeaders },
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Fetch users error:", error);
      Alert.alert("Error", "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [activeTab, getAuthHeaders]);

  const fetchParentsAndRoutes = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders();
      // Fetch all parents
      const pRes = await fetch(`${API_BASE_URL}/api/users/list?role=parent`, {
        headers: { ...authHeaders },
      });
      const pData = await pRes.json();
      setAvailableParents(pData.users || []);

      // Fetch all routes
      const rRes = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
        headers: { ...authHeaders },
      });
      const rData = await rRes.json();
      setAvailableRoutes(rData.routes || []);
    } catch (error) {
      console.error("Fetch parents/routes error:", error);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
    setCurrentPage(1);
    if (activeTab === "students") {
      fetchParentsAndRoutes();
    }
  }, [fetchUsers, fetchParentsAndRoutes, activeTab]);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setSelectedUserId(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      parentId: null,
      routeId: null
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setIsEditMode(true);
    setSelectedUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: "",
      parentId: user.parentId ?? null,
      routeId: user.routeId ?? null
    });
    setModalVisible(true);
  };

  const handleSaveUser = async () => {
    try {
      if (!form.name || !form.email || !form.phone) {
        Alert.alert("Missing details", "Please fill in all required fields.");
        return;
      }
      // For create, password is required
      if (!isEditMode && !form.password) {
        Alert.alert("Missing details", "Password is required for new users.");
        return;
      }

      const authHeaders = await getAuthHeaders();
      const orgId = await getOrgIdFromToken();

      if (!orgId) {
        Alert.alert("Error", "Organization ID not found. Please login again.");
        return;
      }

      const role = activeTab === "students" ? "student" : "parent";

      let url = `${API_BASE_URL}/api/users/create`;
      let method = "POST";
      let body: any = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: role,
        orgId: orgId,
        parentId: form.parentId,
        routeId: form.routeId
      };

      if (isEditMode && selectedUserId) {
        url = `${API_BASE_URL}/api/users/${selectedUserId}`;
        method = "PUT";
        body = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          parentId: form.parentId,
          routeId: form.routeId
        };
      }

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to save user");
      }

      Alert.alert("Success", `User ${isEditMode ? 'updated' : 'added'} successfully`);
      setModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to save user");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this user? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const authHeaders = await getAuthHeaders();
              const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
                method: "DELETE",
                headers: { ...authHeaders },
              });

              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to delete");
              }

              Alert.alert("Success", "User deleted");
              fetchUsers();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Could not delete user");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>People</Text>
          <Text style={styles.subtitle}>Manage students & parents</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleOpenAdd}>
          <Text style={styles.addButtonText}>
            Add {activeTab === "students" ? "Student" : "Parent"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "students" && styles.activeTab]}
          onPress={() => setActiveTab("students")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "students" && styles.activeTabText,
            ]}
          >
            Students
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "parents" && styles.activeTab]}
          onPress={() => setActiveTab("parents")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "parents" && styles.activeTabText,
            ]}
          >
            Parents
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab}...`}
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setCurrentPage(1);
          }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        </View>
      ) : (
        <FlatList
          data={paginatedUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No {activeTab} found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.details}>{item.email}</Text>
                  <Text style={styles.details}>{item.phone}</Text>
                  {item.role === 'student' && (
                    <View style={styles.assignmentDetails}>
                      {item.parentName && (
                        <View style={styles.tag}>
                          <Ionicons name="people" size={12} color={PRIMARY_BLUE} />
                          <Text style={styles.tagText}>P: {item.parentName}</Text>
                        </View>
                      )}
                      {item.routeName && (
                        <View style={styles.tag}>
                          <Ionicons name="map" size={12} color="#4CAF50" />
                          <Text style={styles.tagText}>R: {item.routeName}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color={PRIMARY_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color="#FF4F4F" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(currentPage - 1)}
                >
                  <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#ccc" : PRIMARY_BLUE} />
                  <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                </TouchableOpacity>

                <View style={styles.pageInfo}>
                  <Text style={styles.pageText}>Page {currentPage} of {totalPages}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(currentPage + 1)}
                >
                  <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                  <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#ccc" : PRIMARY_BLUE} />
                </TouchableOpacity>
              </View>
            ) : null
          }
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
            <Text style={styles.modalTitle}>
              {isEditMode ? "Edit" : "Add New"} {activeTab === "students" ? "Student" : "Parent"}
            </Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              placeholder="Ex: John Doe"
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              placeholder="Ex: john@example.com"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(t) => setForm({ ...form, email: t })}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              placeholder="Ex: +977 9800000000"
              style={styles.input}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t })}
            />

            {!isEditMode && (
              <>
                <TextInput
                  placeholder="Set a password"
                  style={styles.input}
                  secureTextEntry
                  value={form.password}
                  onChangeText={(t) => setForm({ ...form, password: t })}
                />
              </>
            )}

            {activeTab === "students" && (
              <View style={styles.assignmentSelectors}>
                <Text style={styles.label}>Assign Parent</Text>
                <View style={styles.pickerWrapper}>
                  <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => {
                      Alert.alert(
                        "Select Parent",
                        "Choose a parent for this student",
                        [
                          { text: "None", onPress: () => setForm({ ...form, parentId: null }) },
                          ...availableParents.map(p => ({
                            text: p.name,
                            onPress: () => setForm({ ...form, parentId: Number(p.id) })
                          })),
                          { text: "Cancel", style: "cancel" }
                        ]
                      );
                    }}
                  >
                    <Text style={form.parentId ? styles.pickerText : styles.pickerPlaceholder}>
                      {form.parentId ? availableParents.find(p => Number(p.id) === form.parentId)?.name : "Select Parent"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Assign Route</Text>
                <View style={styles.pickerWrapper}>
                  <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => {
                      Alert.alert(
                        "Select Route",
                        "Choose a route for this student",
                        [
                          { text: "None", onPress: () => setForm({ ...form, routeId: null }) },
                          ...availableRoutes.map(r => ({
                            text: r.Name,
                            onPress: () => setForm({ ...form, routeId: r.RouteId })
                          })),
                          { text: "Cancel", style: "cancel" }
                        ]
                      );
                    }}
                  >
                    <Text style={form.routeId ? styles.pickerText : styles.pickerPlaceholder}>
                      {form.routeId ? availableRoutes.find(r => r.RouteId === form.routeId)?.Name : "Select Route"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveUser}
              >
                <Text style={styles.saveText}>{isEditMode ? "Update" : "Add User"}</Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#999",
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
  assignmentDetails: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap'
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
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
  assignmentSelectors: {
    marginTop: 4
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 20,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PRIMARY_BLUE,
  },
  pageBtnDisabled: {
    borderColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  pageBtnText: {
    color: PRIMARY_BLUE,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  pageBtnTextDisabled: {
    color: '#ccc',
  },
  pageInfo: {
    paddingHorizontal: 10,
  },
  pageText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});
