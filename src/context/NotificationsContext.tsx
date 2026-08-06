import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { socket } from "@/lib/socket";
import { api } from "@/lib/api";
import { APP_CONFIG } from "@/config";
import { useAuth } from "@/context/AuthContext";

interface NotificationsContextValue {
  unread: number;
  markAllRead: () => void;
  decrement: () => void;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({ unread: 0, markAllRead: () => {}, decrement: () => {}, refresh: () => {} });

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const { user } = useAuth();
  const fetchedRef = useRef(false);

  const refresh = useCallback(() => {
    api.notifications.list()
      .then((notifs: any[]) => {
        setUnread((notifs || []).filter((n: any) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem(APP_CONFIG.frontend.tokenStorageKey);
    if (!token) return;

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("join", user.id);

    const handleNewNotification = () => {
      setUnread((prev) => prev + 1);
    };
    socket.on("new_notification", handleNewNotification);

    if (!fetchedRef.current) {
      fetchedRef.current = true;
      refresh();
    }

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [user?.id, refresh]);

  const markAllRead = useCallback(() => setUnread(0), []);
  const decrement = useCallback(() => setUnread((prev) => Math.max(0, prev - 1)), []);

  return (
    <NotificationsContext.Provider value={{ unread, markAllRead, decrement, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}
