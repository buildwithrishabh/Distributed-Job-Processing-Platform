import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  // null | "auth" | "network"
  connectionError: null,
  subscribeToJob: () => {},
  unsubscribeFromJob: () => {},
});

const getSocketBaseUrl = () => {
  const raw = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!raw || raw.startsWith("/")) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  return raw.replace(/\/api$/, "");
};

// Auth-related error messages sent by the backend socket middleware
const AUTH_ERRORS = new Set([
  "AUTH_COOKIE_MISSING",
  "AUTH_TOKEN_MISSING",
  "AUTH_UNAUTHORIZED",
  "Unauthorized",
  "Authentication required",
  "Access token missing",
]);

export const SocketProvider = ({ user, children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  // "auth" = expired/invalid session, "network" = connectivity issue, null = no error
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);
  // Track which job rooms this client has subscribed to so they can be
  // re-joined automatically after a reconnect (Fix #3)
  const subscribedJobsRef = useRef(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        setConnectionError(null);
      }
      return;
    }

    const socketUrl = getSocketBaseUrl();

    // Fix #1: removed dead `auth: { token }` option — backend reads HttpOnly
    // cookie only and never consults socket.handshake.auth
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);

      // Fix #3: re-subscribe to all tracked job rooms after a reconnect
      subscribedJobsRef.current.forEach((jobId) => {
        newSocket.emit("job:subscribe", jobId);
      });
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Fix #2: distinguish auth errors from network errors so the UI can give
    // the user actionable feedback instead of an infinite "Connecting..." state
    newSocket.on("connect_error", (err) => {
      setIsConnected(false);
      const message = err?.message || "";
      setConnectionError(AUTH_ERRORS.has(message) ? "auth" : "network");
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionError(null);
    };
  }, [user]);

  // Fix #3: guard against emitting on a disconnected socket; track subscribed
  // jobs so they can be re-joined on reconnect
  const subscribeToJob = useCallback((jobId) => {
    if (!jobId) return;
    subscribedJobsRef.current.add(jobId);
    if (socketRef.current?.connected) {
      socketRef.current.emit("job:subscribe", jobId);
    }
    // If the socket is currently reconnecting, the "connect" handler above
    // will re-emit for every entry in subscribedJobsRef once it comes back up
  }, []);

  const unsubscribeFromJob = useCallback((jobId) => {
    if (!jobId) return;
    subscribedJobsRef.current.delete(jobId);
    if (socketRef.current?.connected) {
      socketRef.current.emit("job:unsubscribe", jobId);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionError,
        subscribeToJob,
        unsubscribeFromJob,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
