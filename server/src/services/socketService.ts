import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { serverConfig } from "../config/env.ts";
import { AppointmentConversation } from "../models/AppointmentConversation.ts";

let io: Server;

export function initSocketServer(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: serverConfig.clientOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"));
    }
    try {
      const decoded: any = jwt.verify(token, serverConfig.jwtSecret);
      if (!decoded?.id) {
        return next(new Error("Invalid token"));
      }
      (socket as any).userId = decoded.id;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`User connected: ${socket.id} (userId: ${userId})`);

    // Join personal room based on authenticated user ID
    socket.on("join", (targetUserId: string) => {
      if (targetUserId !== userId) {
        console.warn(`Socket ${socket.id} attempted to join room of user ${targetUserId}, denied`);
        return;
      }
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room ${userId}`);
    });

    // Join admin room
    socket.on("join_admin", () => {
      socket.join("admin_room");
      console.log(`Socket ${socket.id} joined admin_room`);
    });

    // Join session room
    socket.on("join_session", (sessionId: string) => {
      socket.join(`session_${sessionId}`);
      console.log(`Socket ${socket.id} joined session room session_${sessionId}`);
    });

    socket.on("conversation:join", async (conversationId: string, ack?: (result: any) => void) => {
      const conversation = await AppointmentConversation.findById(conversationId);
      if (!conversation || (conversation.userId.toString() !== userId && conversation.therapistId.toString() !== userId)) {
        return ack?.({ ok: false, message: "Conversation access denied" });
      }
      socket.join(`appointment_${conversation._id}`);
      ack?.({ ok: true });
    });

    // Send chat message
    socket.on("send_message", (data: { sessionId: string; message: any }) => {
      socket.to(`session_${data.sessionId}`).emit("receive_message", data.message);
    });

    // Typing indicator
    socket.on("typing", (data: { sessionId: string; userId: string; isTyping: boolean }) => {
      socket.to(`session_${data.sessionId}`).emit("typing_status", data);
    });

    socket.on("typing:start", async (conversationId: string) => {
      const conversation = await AppointmentConversation.findById(conversationId);
      if (conversation && (conversation.userId.toString() === userId || conversation.therapistId.toString() === userId)) socket.to(`appointment_${conversationId}`).emit("typing:start", { conversationId, userId });
    });
    socket.on("typing:stop", async (conversationId: string) => {
      const conversation = await AppointmentConversation.findById(conversationId);
      if (conversation && (conversation.userId.toString() === userId || conversation.therapistId.toString() === userId)) socket.to(`appointment_${conversationId}`).emit("typing:stop", { conversationId, userId });
    });

    // WebRTC signaling
    socket.on("voice_call_request", (data: { targetUserId: string; sessionId: string; callerName: string }) => {
      socket.to(data.targetUserId).emit("incoming_voice_call", data);
    });

    socket.on("voice_signal", (data: { targetUserId: string; signal: any }) => {
      socket.to(data.targetUserId).emit("voice_signal", {
        senderSocketId: socket.id,
        signal: data.signal
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  console.log("WebSocket server initialized.");
}

export function emitNotification(userId: string, notification: any) {
  if (!io) return;
  io.to(userId).emit("new_notification", notification);
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}
