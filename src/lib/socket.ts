import { io } from "socket.io-client";
import { APP_CONFIG } from "@/config";

// Connect using window.location.origin.
// Vite proxy forwards /socket.io request to the backend in dev,
// and in production it natively routes to the backend server.
export const socket = io(window.location.origin, {
  autoConnect: false,
  auth: () => ({
    token: localStorage.getItem(APP_CONFIG.frontend.tokenStorageKey) || "",
  }),
});
