import { io } from "socket.io-client";

// Replace with your actual backend URL
const SOCKET_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.73:8004";

const socket = io(SOCKET_URL, {
    autoConnect: false,
});

export const connectSocket = (routeId?: number) => {
    if (!socket.connected) {
        socket.connect();
    }
    if (routeId) {
        socket.emit("join-route", routeId);
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

// Send driver GPS location to server via Socket.IO
export const emitLocationUpdate = (data: {
    tripId: number;
    routeId: number;
    latitude: number;
    longitude: number;
    driverId: number;
}) => {
    if (socket.connected) {
        socket.emit("update-location", data);
    }
};

// Listen for live bus location updates
export const onLocationUpdate = (
    callback: (data: {
        tripId: number;
        latitude: number;
        longitude: number;
        driverId: number;
        timestamp: string;
    }) => void
) => {
    socket.on("location-update", callback);
    return () => {
        socket.off("location-update", callback);
    };
};

export default socket;
