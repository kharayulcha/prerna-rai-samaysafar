import { io } from "socket.io-client";

// Replace with your actual backend URL
const SOCKET_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

const socket = io(SOCKET_URL, {
    autoConnect: false,
});

export const connectSocket = (routeId?: number) => {
    if (!socket.connected) {
        socket.connect();
        if (routeId) {
            socket.emit("join-route", routeId);
        }
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

export const onLocationUpdate = (callback: (data: any) => void) => {
    socket.on("location-update", callback);
    return () => {
        socket.off("location-update", callback);
    };
};

export const emitLocationUpdate = (data: any) => {
    socket.emit("location-update", data);
};

export default socket;
