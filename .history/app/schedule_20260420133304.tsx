// Fallback file - Metro requires this for platform selection.
// Metro automatically selects: schedule.web.tsx on web, schedule.native.tsx on native
export { default } from "./schedule.native";
{
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [studentSchedule, setStudentSchedule] = useState<any[]>([]);
  // Student stops state
  const [studentStops, setStudentStops] = useState<any[]>([]);
  const [assignedRouteInfo, setAssignedRouteInfo] = useState<any>(null);

  // Form State
  const [name, setName] = useState("");
  const [time, setTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Landmarks State
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [showLandmarkForm, setShowLandmarkForm] = useState(false);
  const [newLandmarkName, setNewLandmarkName] = useState("");
  const [newLandmarkLat, setNewLandmarkLat] = useState("");
  const [newLandmarkLng, setNewLandmarkLng] = useState("");
  const [editingLandmarkId, setEditingLandmarkId] = useState<string | null>(
    null,
  );
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Place search state
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<any[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const getStoredToken = useCallback(async () => {
    return await AsyncStorage.getItem("authToken");
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<
    Record<string, string>
  > => {
    const rawToken = await getStoredToken();
    const token = rawToken?.startsWith("Bearer ")
      ? rawToken.slice(7)
      : rawToken;
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
        const res = await fetch(
          `${API_BASE_URL}/api/routes/student-schedule/view`,
          {
            headers: { ...authHeaders },
          },
        );
        const data = await res.json();
        if (data.schedule) {
          setStudentSchedule(data.schedule);
          setAssignedRouteInfo({
            name: data.routeName,
            driver: data.driver,
            bus: data.bus,
            startTime: formatTimeStr(data.startTime),
          });
          if (data.stops) {
            setStudentStops(data.stops);
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/routes/get-routes`, {
          headers: { ...authHeaders },
        });
        const data = await res.json();

        const mapped: RouteItem[] = (data.routes || []).map((r: any) => ({
          id: r.RouteId?.toString() ?? Math.random().toString(),
          name: r.Name,
          time: formatTimeStr(r.StartTime),
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
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTimeStr = (timeStr: string) => {
    if (!timeStr || timeStr === "--") return timeStr;
    if (
      timeStr.toLowerCase().includes("am") ||
      timeStr.toLowerCase().includes("pm")
    )
      return timeStr;
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
  };

  const parseTimeString = (timeStr: string) => {
    try {
      // Expect "07:00 AM" format
      const [time, period] = timeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

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
    setLandmarks([]);
    setShowLandmarkForm(false);
    setNewLandmarkName("");
    setNewLandmarkLat("");
    setNewLandmarkLng("");
    setEditingLandmarkId(null);
    setPlaceQuery("");
    setPlaceResults([]);
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
      setSelectedDays(item.days.split(",").map((d) => d.trim()));
    }

    // Fetch landmarks/stops for this route
    fetchRouteLandmarks(item.id);

    setShowLandmarkForm(false);
    setNewLandmarkName("");
    setNewLandmarkLat("");
    setNewLandmarkLng("");
    setEditingLandmarkId(null);
    setModalVisible(true);
  };

  const fetchRouteLandmarks = async (routeId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/routes/${routeId}/stops`, {
        headers: { ...authHeaders },
      });
      const data = await res.json();
      if (data.stops) {
        setLandmarks(data.stops);
      } else {
        setLandmarks([]);
      }
    } catch (error) {
      console.error("Error fetching landmarks:", error);
      setLandmarks([]);
    }
  };

  const handleUseMyLocation = async () => {
    try {
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Allow location access to use this feature.",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setNewLandmarkLat(loc.coords.latitude.toFixed(6));
      setNewLandmarkLng(loc.coords.longitude.toFixed(6));
      setPlaceResults([]);
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not get your location. Enter coordinates manually.",
      );
    } finally {
      setFetchingLocation(false);
    }
  };

  const handlePlaceSearch = (text: string) => {
    setPlaceQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setPlaceResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearchingPlace(true);
        const encoded = encodeURIComponent(text.trim());
        // Proxy through backend to avoid React Native mobile network request blocks
        const res = await fetch(
          `${API_BASE_URL}/api/routes/utility/search-places?q=${encoded}`,
        );
        const data = await res.json();
        const mappedResults = (data.features || []).map(
          (f: any, idx: number) => {
            const props = f.properties;
            const coords = f.geometry.coordinates; // [lon, lat]
            const addressParts = [
              props.name,
              props.city,
              props.state,
              props.country,
            ].filter(Boolean);
            const uniqueParts = Array.from(new Set(addressParts));
            return {
              place_id: props.osm_id || idx,
              display_name: uniqueParts.join(", "),
              lat: coords[1],
              lon: coords[0],
            };
          },
        );
        setPlaceResults(mappedResults);
      } catch (err) {
        console.warn("Place search error:", err);
        setPlaceResults([]);
      } finally {
        setSearchingPlace(false);
      }
    }, 500);
  };

  const handleSelectPlace = (place: any) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setNewLandmarkLat(lat.toFixed(6));
    setNewLandmarkLng(lng.toFixed(6));
    if (!newLandmarkName.trim()) {
      setNewLandmarkName(place.display_name.split(",")[0]);
    }
    setPlaceResults([]);
    setPlaceQuery("");
    // Animate map to the selected place
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      600,
    );
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setNewLandmarkLat(latitude.toFixed(6));
    setNewLandmarkLng(longitude.toFixed(6));
  };

  const handleAddLandmark = async () => {
    if (!newLandmarkName.trim()) {
      Alert.alert("Missing Name", "Please enter a landmark name.");
      return;
    }
    if (!newLandmarkLat || !newLandmarkLng) {
      Alert.alert(
        "Missing Location",
        "Search a place, tap on the map, or use your current location to set the landmark position.",
      );
      return;
    }

    // If route already exists (edit mode), save to backend immediately
    if (isEditMode && selectedRouteId) {
      try {
        const authHeaders = await getAuthHeaders();

        if (editingLandmarkId) {
          // Update existing
          const res = await fetch(
            `${API_BASE_URL}/api/routes/${selectedRouteId}/stops/${editingLandmarkId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: JSON.stringify({
                name: newLandmarkName,
                latitude: parseFloat(newLandmarkLat),
                longitude: parseFloat(newLandmarkLng),
                sequenceOrder:
                  landmarks.find(
                    (l: any) => String(l.StopId) === editingLandmarkId,
                  )?.SequenceOrder || landmarks.length + 1,
              }),
            },
          );
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to update landmark");
          }
        } else {
          // Add new
          const res = await fetch(
            `${API_BASE_URL}/api/routes/${selectedRouteId}/stops`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: JSON.stringify({
                name: newLandmarkName,
                latitude: parseFloat(newLandmarkLat),
                longitude: parseFloat(newLandmarkLng),
              }),
            },
          );
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to add landmark");
          }
        }

        // Refresh landmarks
        await fetchRouteLandmarks(selectedRouteId);
      } catch (error: any) {
        Alert.alert("Error", error?.message ?? "Failed to save landmark");
        return;
      }
    } else {
      // For new routes, store locally until route is saved
      if (editingLandmarkId) {
        setLandmarks(
          landmarks.map((l: any) =>
            (l._tempId || String(l.StopId)) === editingLandmarkId
              ? {
                  ...l,
                  Name: newLandmarkName,
                  Latitude: parseFloat(newLandmarkLat),
                  Longitude: parseFloat(newLandmarkLng),
                }
              : l,
          ),
        );
      } else {
        setLandmarks([
          ...landmarks,
          {
            _tempId: Date.now().toString(),
            Name: newLandmarkName,
            Latitude: parseFloat(newLandmarkLat),
            Longitude: parseFloat(newLandmarkLng),
            SequenceOrder: landmarks.length + 1,
          },
        ]);
      }
    }

    // Reset form
    setNewLandmarkName("");
    setNewLandmarkLat("");
    setNewLandmarkLng("");
    setEditingLandmarkId(null);
    setPlaceQuery("");
    setPlaceResults([]);
    setShowLandmarkForm(false);
  };

  const handleEditLandmark = (landmark: any) => {
    const id = landmark.StopId ? String(landmark.StopId) : landmark._tempId;
    setEditingLandmarkId(id);
    setNewLandmarkName(landmark.Name);
    setNewLandmarkLat(String(landmark.Latitude));
    setNewLandmarkLng(String(landmark.Longitude));
    setShowLandmarkForm(true);
  };

  const handleDeleteLandmark = async (landmark: any) => {
    if (isEditMode && selectedRouteId && landmark.StopId) {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE_URL}/api/routes/${selectedRouteId}/stops/${landmark.StopId}`,
          {
            method: "DELETE",
            headers: { ...authHeaders },
          },
        );
        if (!res.ok) throw new Error("Failed to delete landmark");
        await fetchRouteLandmarks(selectedRouteId);
      } catch (error: any) {
        Alert.alert("Error", error?.message ?? "Failed to delete landmark");
      }
    } else {
      // Remove from local state
      const removeId = landmark._tempId || String(landmark.StopId);
      setLandmarks(
        landmarks.filter(
          (l: any) => (l._tempId || String(l.StopId)) !== removeId,
        ),
      );
    }
  };

  const handleSave = async () => {
    try {
      if (!name || selectedDays.length === 0) {
        Alert.alert(
          "Missing details",
          "Please enter a name and select at least one day.",
        );
        return;
      }

      const authHeaders = await getAuthHeaders();
      const orgId = await getOrgIdFromToken();
      if (!orgId) {
        Alert.alert("Error", "Organization ID missing. Please login again.");
        return;
      }

      const daysString =
        selectedDays.length === 7 ? "Daily" : selectedDays.join(",");
      const timeString = formatTime(time);

      let url = `${API_BASE_URL}/api/routes/create-route`;
      let method = "POST";
      let body: any = {
        name: name,
        startTime: timeString,
        scheduleDays: daysString,
        busIds: [],
        driverIds: [],
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

      // For new routes: save pending landmarks
      if (!isEditMode && landmarks.length > 0) {
        try {
          const resData = await res.json();
          const newRouteId = resData?.route?.RouteId;
          if (newRouteId) {
            for (const lm of landmarks) {
              await fetch(`${API_BASE_URL}/api/routes/${newRouteId}/stops`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({
                  name: lm.Name,
                  latitude: lm.Latitude,
                  longitude: lm.Longitude,
                  sequenceOrder: lm.SequenceOrder,
                }),
              });
            }
          }
        } catch (e) {
          console.warn("Could not save landmarks after route creation:", e);
        }
      }

      Alert.alert(
        "Success",
        `Route ${isEditMode ? "updated" : "added"} successfully`,
      );
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
          },
        },
      ],
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
        {userRole !== "student" && userRole !== "parent" && (
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
                  <Text style={styles.assignedRouteName}>
                    {assignedRouteInfo.name}
                  </Text>
                </View>
                <View style={styles.routeDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="person" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Driver: {assignedRouteInfo.driver}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="bus" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Bus: {assignedRouteInfo.bus}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Default Start:{" "}
                      {formatTimeStr(assignedRouteInfo.startTime)}
                    </Text>
                  </View>
                </View>

                {/* Stop Timeline for Students (Estimated Arrival Style) */}
                {studentStops.length > 0 && (
                  <View style={styles.etaSection}>
                    <View style={styles.etaDivider} />
                    <View style={styles.etaHeader}>
                      <Ionicons
                        name="navigate"
                        size={14}
                        color={PRIMARY_BLUE}
                      />
                      <Text style={styles.etaHeaderText}>
                        Estimated Arrival
                      </Text>
                    </View>
                    {studentStops
                      .sort(
                        (a: any, b: any) => a.sequenceOrder - b.sequenceOrder,
                      )
                      .map((stop: any, index: number) => (
                        <View key={stop.id || index} style={styles.etaRow}>
                          <View style={styles.etaStopDot} />
                          <Text style={styles.etaStopName} numberOfLines={1}>
                            {stop.name}
                          </Text>
                          <Text style={styles.etaTime}>
                            Stop {stop.sequenceOrder}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            )
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No assigned route schedule found.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.scheduleItem}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{item.day}</Text>
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleTime}>
                  {formatTimeStr(item.time)}
                </Text>
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>No routes found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.routeCard}>
              <View style={styles.cardContentContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getInitials(item.name)}
                  </Text>
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>{item.name}</Text>
                  <Text style={styles.routeTime}>{item.time}</Text>
                  <Text style={styles.routeDays}>{item.days}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => handleOpenEdit(item)}
                  style={styles.actionBtn}
                >
                  <Ionicons name="pencil" size={20} color={PRIMARY_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={styles.actionBtn}
                >
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: "100%" }}
            >
              <Text style={styles.modalTitle}>
                {isEditMode ? "Edit Route" : "Add New Route"}
              </Text>

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
                  display={Platform.OS === "ios" ? "spinner" : "default"}
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
                      style={[
                        styles.dayChip,
                        isSelected && styles.dayChipSelected,
                      ]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Landmarks/Stops Section */}
              <View style={styles.landmarkSection}>
                <View style={styles.landmarkHeader}>
                  <Text style={styles.label}>Landmarks / Stops</Text>
                  <TouchableOpacity
                    style={styles.addLandmarkBtn}
                    onPress={() => {
                      setShowLandmarkForm(!showLandmarkForm);
                      if (!showLandmarkForm) {
                        setEditingLandmarkId(null);
                        setNewLandmarkName("");
                        setNewLandmarkLat("");
                        setNewLandmarkLng("");
                      }
                    }}
                  >
                    <Ionicons
                      name={showLandmarkForm ? "close-circle" : "add-circle"}
                      size={24}
                      color={PRIMARY_BLUE}
                    />
                    <Text style={styles.addLandmarkText}>
                      {showLandmarkForm ? "Close" : "Add"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Landmark Form */}
                {showLandmarkForm && (
                  <View style={styles.landmarkForm}>
                    {/* Search for a place */}
                    <Text style={styles.landmarkFormLabel}>
                      Search a place to pinpoint its location
                    </Text>

                    <View style={styles.searchContainer}>
                      <Ionicons
                        name="search"
                        size={18}
                        color="#888"
                        style={{ marginLeft: 10 }}
                      />
                      <TextInput
                        placeholder="Search place (e.g. Sangeet Chowk, Dharan)"
                        style={styles.searchInput}
                        value={placeQuery}
                        onChangeText={handlePlaceSearch}
                        autoCorrect={false}
                      />
                      {searchingPlace && (
                        <ActivityIndicator
                          size="small"
                          color={PRIMARY_BLUE}
                          style={{ marginRight: 10 }}
                        />
                      )}
                    </View>

                    {/* Search Results Dropdown */}
                    {placeResults.length > 0 && (
                      <View style={styles.searchResults}>
                        {placeResults.map((place: any, idx: number) => (
                          <TouchableOpacity
                            key={place.place_id || idx}
                            style={styles.searchResultItem}
                            onPress={() => handleSelectPlace(place)}
                          >
                            <Ionicons
                              name="location-outline"
                              size={16}
                              color={PRIMARY_BLUE}
                            />
                            <Text
                              style={styles.searchResultText}
                              numberOfLines={2}
                            >
                              {place.display_name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Or use current location */}
                    <TouchableOpacity
                      style={styles.useLocationBtn}
                      onPress={handleUseMyLocation}
                      disabled={fetchingLocation}
                    >
                      {fetchingLocation ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="locate" size={18} color="#fff" />
                      )}
                      <Text style={styles.useLocationText}>
                        {fetchingLocation
                          ? "Getting location..."
                          : "Or Use My Current Location"}
                      </Text>
                    </TouchableOpacity>

                    {/* Interactive Map */}
                    <View style={styles.mapContainer}>
                      <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                          latitude: newLandmarkLat
                            ? parseFloat(newLandmarkLat)
                            : 26.8123,
                          longitude: newLandmarkLng
                            ? parseFloat(newLandmarkLng)
                            : 87.2718,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        onPress={handleMapPress}
                        mapType="standard"
                      >
                        {landmarks.length > 1 && (
                          <Polyline
                            coordinates={landmarks
                              .slice()
                              .sort(
                                (a: any, b: any) =>
                                  a.SequenceOrder - b.SequenceOrder,
                              )
                              .map((lm: any) => {
                                const isEditing =
                                  (lm._tempId || String(lm.StopId)) ===
                                  editingLandmarkId;
                                return {
                                  latitude:
                                    isEditing && newLandmarkLat
                                      ? parseFloat(newLandmarkLat)
                                      : parseFloat(lm.Latitude),
                                  longitude:
                                    isEditing && newLandmarkLng
                                      ? parseFloat(newLandmarkLng)
                                      : parseFloat(lm.Longitude),
                                };
                              })}
                            strokeColor="#3B82F6"
                            strokeWidth={3}
                            lineDashPattern={[10, 5]}
                          />
                        )}

                        {landmarks.map((lm: any) => {
                          const isEditing =
                            (lm._tempId || String(lm.StopId)) ===
                            editingLandmarkId;
                          if (isEditing) return null;

                          return (
                            <Marker
                              key={lm.StopId ? String(lm.StopId) : lm._tempId}
                              coordinate={{
                                latitude: parseFloat(lm.Latitude),
                                longitude: parseFloat(lm.Longitude),
                              }}
                              title={lm.Name}
                              description={`Stop ${lm.SequenceOrder}`}
                            >
                              <View style={{ alignItems: "center" }}>
                                <View
                                  style={{
                                    backgroundColor: "#3B82F6",
                                    borderRadius: 12,
                                    width: 24,
                                    height: 24,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderWidth: 2,
                                    borderColor: "#FFF",
                                    elevation: 5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#FFF",
                                      fontWeight: "bold",
                                      fontSize: 12,
                                    }}
                                  >
                                    {lm.SequenceOrder}
                                  </Text>
                                </View>
                              </View>
                            </Marker>
                          );
                        })}

                        {newLandmarkLat && newLandmarkLng ? (
                          <Marker
                            coordinate={{
                              latitude: parseFloat(newLandmarkLat),
                              longitude: parseFloat(newLandmarkLng),
                            }}
                            title={newLandmarkName || "Selected Location"}
                            pinColor="#ef4444"
                            draggable
                            onDragEnd={(e) => {
                              const { latitude, longitude } =
                                e.nativeEvent.coordinate;
                              setNewLandmarkLat(latitude.toFixed(6));
                              setNewLandmarkLng(longitude.toFixed(6));
                            }}
                          >
                            <View style={{ alignItems: "center" }}>
                              <View
                                style={{
                                  backgroundColor: "#ef4444",
                                  borderRadius: 12,
                                  width: 24,
                                  height: 24,
                                  justifyContent: "center",
                                  alignItems: "center",
                                  borderWidth: 2,
                                  borderColor: "#FFF",
                                  elevation: 5,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#FFF",
                                    fontWeight: "bold",
                                    fontSize: 12,
                                  }}
                                >
                                  {editingLandmarkId
                                    ? landmarks.find(
                                        (l: any) =>
                                          (l._tempId || String(l.StopId)) ===
                                          editingLandmarkId,
                                      )?.SequenceOrder
                                    : landmarks.length + 1}
                                </Text>
                              </View>
                            </View>
                          </Marker>
                        ) : null}
                      </MapView>
                      <Text style={styles.mapHint}>
                        Tap on the map to pinpoint, or drag the marker to adjust
                      </Text>
                    </View>

                    {/* Selected coordinates preview */}
                    {newLandmarkLat && newLandmarkLng ? (
                      <View style={styles.locationPreview}>
                        <Ionicons name="location" size={20} color="#ef4444" />
                        <Text style={styles.locationPreviewText}>
                          {parseFloat(newLandmarkLat).toFixed(4)},{" "}
                          {parseFloat(newLandmarkLng).toFixed(4)}
                        </Text>
                      </View>
                    ) : null}

                    <TextInput
                      placeholder="Landmark Name (e.g. Sangeet Chowk)"
                      style={[styles.input, { marginTop: 10 }]}
                      value={newLandmarkName}
                      onChangeText={setNewLandmarkName}
                    />

                    <View style={styles.coordRow}>
                      <View style={styles.coordField}>
                        <Text style={styles.coordLabel}>Lat</Text>
                        <TextInput
                          style={styles.coordInput}
                          value={newLandmarkLat}
                          onChangeText={setNewLandmarkLat}
                          keyboardType="numeric"
                          placeholder="Latitude"
                        />
                      </View>
                      <View style={styles.coordField}>
                        <Text style={styles.coordLabel}>Lng</Text>
                        <TextInput
                          style={styles.coordInput}
                          value={newLandmarkLng}
                          onChangeText={setNewLandmarkLng}
                          keyboardType="numeric"
                          placeholder="Longitude"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.saveLandmarkBtn}
                      onPress={handleAddLandmark}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.saveLandmarkText}>
                        {editingLandmarkId
                          ? "Update Landmark"
                          : "Save Landmark"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Existing Landmarks List */}
                {landmarks.length > 0 && (
                  <View style={styles.landmarkList}>
                    {landmarks
                      .sort(
                        (a: any, b: any) =>
                          (a.SequenceOrder || 0) - (b.SequenceOrder || 0),
                      )
                      .map((lm: any, index: number) => (
                        <View
                          key={lm.StopId || lm._tempId || index}
                          style={styles.landmarkItem}
                        >
                          <View style={styles.landmarkNum}>
                            <Text style={styles.landmarkNumText}>
                              {index + 1}
                            </Text>
                          </View>
                          <View style={styles.landmarkInfo}>
                            <Text style={styles.landmarkName}>{lm.Name}</Text>
                            <Text style={styles.landmarkCoord}>
                              {lm.Latitude?.toFixed(4)},{" "}
                              {lm.Longitude?.toFixed(4)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleEditLandmark(lm)}
                            style={styles.landmarkAction}
                          >
                            <Ionicons
                              name="pencil"
                              size={16}
                              color={PRIMARY_BLUE}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteLandmark(lm)}
                            style={styles.landmarkAction}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#FF4F4F"
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                )}

                {landmarks.length === 0 && !showLandmarkForm && (
                  <Text style={styles.noLandmarkText}>
                    No landmarks added yet. Tap "Add" to pinpoint stops.
                  </Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveText}>
                    {isEditMode ? "Update" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardContentContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    padding: 6,
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    maxHeight: "90%",
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
    marginBottom: 8,
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
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#f9f9f9",
  },
  timeButtonText: {
    fontSize: 16,
    color: "#333",
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  dayChipSelected: {
    backgroundColor: PRIMARY_BLUE,
    borderColor: PRIMARY_BLUE,
  },
  dayText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 20,
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
    alignItems: "center",
  },
  cancelText: {
    color: "#666",
    fontWeight: "600",
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
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
  },
  // Landmark styles
  landmarkSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  landmarkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addLandmarkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addLandmarkText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: "600",
  },
  landmarkForm: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  landmarkFormLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    fontSize: 14,
  },
  searchResults: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 10,
    maxHeight: 180,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchResultText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  useLocationBtn: {
    backgroundColor: "#6B7280",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  useLocationText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  locationPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  locationPreviewText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  mapContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  map: {
    width: "100%",
    height: 220,
  },
  mapHint: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: "#f9f9f9",
  },
  coordRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  coordField: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
    fontWeight: "600",
  },
  coordInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    backgroundColor: "#fff",
  },
  saveLandmarkBtn: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveLandmarkText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  landmarkList: {
    gap: 8,
  },
  landmarkItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f7ff",
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  landmarkNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY_BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  landmarkNumText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  landmarkInfo: {
    flex: 1,
  },
  landmarkName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  landmarkCoord: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  landmarkAction: {
    padding: 4,
  },
  noLandmarkText: {
    textAlign: "center",
    color: "#999",
    fontSize: 13,
    paddingVertical: 10,
  },
  // ETA styles (borrowed from Map for Student Schedule)
  etaSection: {
    marginTop: 4,
  },
  etaDivider: {
    height: 1,
    backgroundColor: "#EEE",
    marginVertical: 8,
  },
  etaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  etaHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY_BLUE,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    gap: 8,
  },
  etaStopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FBBF24",
  },
  etaStopName: {
    flex: 1,
    fontSize: 13,
    color: "#555",
  },
  etaTime: {
    fontSize: 13,
    fontWeight: "700",
    color: DEEP_BLUE,
  },
});
