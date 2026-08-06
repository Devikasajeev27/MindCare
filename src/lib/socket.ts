import { io } from "socket.io-client";
import { APP_CONFIG } from "@/config";
import { FRONTEND_ENV } from "@/config/frontEnvConfig";

const socketServerUrl = FRONTEND_ENV.apiBase
  ? FRONTEND_ENV.apiBase.replace(/\/api\/?$/, "")
  : "https://mindcare-backend-5yrz.onrender.com";

export const socket = io(socketServerUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  auth: () => ({
    token: localStorage.getItem(APP_CONFIG.frontend.tokenStorageKey) || "",
  }),
});
