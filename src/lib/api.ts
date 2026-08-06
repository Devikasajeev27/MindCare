import { FRONTEND_ENV, APP_CONFIG } from "@/config";

const API_BASE = FRONTEND_ENV.apiBase;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Helper to get headers
function getHeaders(contentType = "application/json"): HeadersInit {
  const headers: HeadersInit = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const token = localStorage.getItem(APP_CONFIG.frontend.tokenStorageKey);

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Base request function
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(options.body instanceof FormData ? "" : "application/json"),
        ...options.headers,
      },
    });
  } catch (networkError: any) {
    // The server is completely unreachable (offline, ECONNREFUSED, etc.)
    console.error("[API] Network error:", networkError);
    throw new ApiError(
      "Cannot connect to the server. Please make sure the backend is running.",
      0
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(APP_CONFIG.frontend.tokenStorageKey);
    }
    const data = await response.json().catch(() => ({}));
    let message = data.message || response.statusText;

    if (response.status === 503) {
      message = "The server database is not connected. Please run: npm install --save-dev mongodb-memory-server && npm run dev";
    } else if (response.status === 500) {
      console.error(`[API] 500 Internal Server Error on ${endpoint}`, data);
      message = "A server error occurred. Please try again later.";
    } else if (response.status === 0 || response.status === 502) {
      message = "The server is currently unavailable. Please try again later.";
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const json = await response.json();
  if (json && typeof json === "object" && Object.prototype.hasOwnProperty.call(json, "success") && Object.prototype.hasOwnProperty.call(json, "data")) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  // Auth
  auth: {
    async register(data: any) {
      const res = await request<{ token: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      localStorage.setItem(APP_CONFIG.frontend.tokenStorageKey, res.token);
      return res.user;
    },

    async login(data: any) {
      const res = await request<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      localStorage.setItem(APP_CONFIG.frontend.tokenStorageKey, res.token);
      return res.user;
    },

    async getProfile() {
      const res = await request<{ user: any }>("/auth/profile");
      return res.user;
    },

    async updateProfile(data: any) {
      const res = await request<{ user: any }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return res.user;
    },

    async completeOnboarding(data: { answers: any; wellnessScore: number }) {
      const res = await request<{ user: any }>("/auth/onboarding", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.user;
    },

    async toggleCompanionStatus(isAvailableAsCompanion: boolean) {
      const res = await request<{ isAvailableAsCompanion: boolean }>("/auth/companion-status", {
        method: "PUT",
        body: JSON.stringify({ isAvailableAsCompanion }),
      });
      return res;
    },

    async deleteAccount() {
      const res = await request<{ message: string }>("/auth/profile", {
        method: "DELETE",
      });
      localStorage.removeItem(APP_CONFIG.frontend.tokenStorageKey);
      return res;
    },

    async exportAccountData(): Promise<Blob> {
      const url = `${API_BASE}/auth/export`;
      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(""),
      });
      if (!response.ok) {
        throw new ApiError("Failed to export personal data", response.status);
      }
      return response.blob();
    },

    logout() {
      localStorage.removeItem(APP_CONFIG.frontend.tokenStorageKey);
    },
  },

  // Moods
  moods: {
    async list() {
      const res = await request<any>("/moods/history");
      return Array.isArray(res) ? res : res?.moods || [];
    },

    async getHistory() {
      const res = await request<any>("/moods/history");
      return res;
    },

    async add(rating: number, note?: string, date?: string, emotion?: string) {
      const res = await request<{ mood: any }>("/moods", {
        method: "POST",
        body: JSON.stringify({ rating, note, date, emotion }),
      });
      return res.mood;
    },

    async getAnalytics() {
      const res = await request<any>("/moods/history");
      return res;
    },
  },

  // Progress
  progress: {
    async getSummary() {
      const res = await request<{ progress: any }>("/progress/summary");
      return res.progress;
    },
  },

  // Journals
  journals: {
    async list() {
      const res = await request<{ journals: any[] }>("/journals");
      return res.journals;
    },

    async add(data: { title: string; content: string; mood?: number; date?: string }) {
      const res = await request<{ journal: any }>("/journals", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.journal;
    },

    async update(id: string, data: { title?: string; content?: string; mood?: number }) {
      const res = await request<{ journal: any }>(`/journals/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return res.journal;
    },

    async delete(id: string) {
      return request<{ message: string }>(`/journals/${id}`, {
        method: "DELETE",
      });
    },
  },

  // Resources
  resources: {
    async list(params?: { search?: string; category?: string }) {
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.category) query.set("category", params.category);
      const qs = query.toString();
      const res = await request<{ resources: any[]; categories: string[] }>(
        `/resources${qs ? `?${qs}` : ""}`
      );
      return res;
    },
  },

  // Therapists
  therapists: {
    async list() {
      const res = await request<{ therapists: any[] }>("/therapists");
      return res.therapists;
    },

    async addReview(therapistId: string, rating: number, comment: string) {
      const res = await request<{ therapist: any }>(`/therapists/${therapistId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });
      return res.therapist;
    },

    async updateAvailability(availability: any) {
      const res = await request<{ availability: any }>("/therapist/availability", {
        method: "PUT",
        body: JSON.stringify({ availability }),
      });
      return res.availability;
    },

    async register(data: {
      title: string;
      specializations: string | string[];
      yearsExperience: number | string;
      consultationFee: number | string;
      availability: string;
    }) {
      const res = await request<{ therapist: any }>("/therapists/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.therapist;
    },

    async getDashboardStats(period?: '7 Days' | '30 Days' | 'Quarterly' | 'Yearly') {
      const query = period ? `?period=${encodeURIComponent(period)}` : "";
      return request<{ stats: any }>(`/therapist/dashboard/stats${query}`);
    },

    async updateEmergencyOnCall(onCall: boolean) {
      return request<{ onCall: boolean; status: string }>("/therapist/emergency-on-call", {
        method: "PUT",
        body: JSON.stringify({ onCall }),
      });
    },

    async getEmergencyCases() {
      return request<{ cases: any[] }>("/therapist/emergency-cases");
    },

    async acceptEmergencyCase(caseId: string) {
      return request<{ assignment: any }>(`/therapist/emergency-cases/${caseId}/accept`, { method: "POST" });
    },

    async declineEmergencyCase(caseId: string) {
      return request<{ assignment: any }>(`/therapist/emergency-cases/${caseId}/decline`, { method: "POST" });
    },

    async getAppointments() {
      const res = await request<{ appointments: any[] }>("/appointments");
      return res.appointments;
    },

    async bookAppointment(data: { therapistId: string; date: string; timeSlot: string; amountPaid?: number }) {
      return request<{ appointment: any; rzpOrder: any; razorpayKeyId: string }>("/appointments", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async getAppointmentDetails(appointmentId: string) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}`);
      return res.appointment;
    },

    async cancelAppointment(appointmentId: string, reason?: string) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return res.appointment;
    },

    async rescheduleAppointment(appointmentId: string, date: string, timeSlot: string) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}/reschedule`, {
        method: "PUT",
        body: JSON.stringify({ date, timeSlot }),
      });
      return res.appointment;
    },

    async setAppointmentReminder(appointmentId: string, reminderTimes: string[]) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}/reminder`, {
        method: "POST",
        body: JSON.stringify({ reminderTimes }),
      });
      return res.appointment;
    },

    async reviewAppointment(appointmentId: string, review: string) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}/review`, {
        method: "POST",
        body: JSON.stringify({ review }),
      });
      return res.appointment;
    },

    async approveAppointment(appointmentId: string) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}/approve`, {
        method: "PUT",
      });
      return res.appointment;
    },

    async rejectAppointment(appointmentId: string, reason?: string) {
      const res = await request<{ appointment: any }>(`/appointments/${appointmentId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      });
      return res.appointment;
    },
  },
  // Appointments namespace
  appointments: {
    async getAll() {
      const res = await request<{ appointments: any[] }>("/appointments");
      return res.appointments;
    },
    async getBookedSlots(therapistId: string, date: string) {
      const res = await request<{ bookedSlots: string[] }>(`/appointments/booked-slots?therapistId=${encodeURIComponent(therapistId)}&date=${encodeURIComponent(date)}`);
      return res.bookedSlots;
    },
    async triggerAutoCancel() {
      return request<{ message: string; processedCount: number }>("/appointments/cron/auto-cancel", { method: "POST" });
    },
    async getUpcoming() {
      const res = await request<{ appointment: any }>(`/appointments/upcoming`);
      return res.appointment;
    },
    async getByTherapist(therapistId: string) {
      const appointments = await this.getAll();
      return appointments.find((appointment: any) => String(appointment.therapistId?._id || appointment.therapistId) === therapistId) || null;
    },
    async getMessageableAppointment(therapistId: string) {
      const res = await request<{ appointment: any }>(`/appointments/therapist/${encodeURIComponent(therapistId)}/messaging`);
      return res.appointment;
    },
    async getConversation(appointmentId: string) {
      return request<{ conversation: any; messages: any[]; messagingAllowed: boolean }>(`/appointments/${appointmentId}/conversation`);
    },
    async sendMessage(appointmentId: string, text: string) {
      return request<{ message: any }>(`/appointments/${appointmentId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
    },
    async markMessagesRead(appointmentId: string) {
      return request<{ updated: number }>(`/appointments/${appointmentId}/messages/read`, { method: "PUT" });
    },
    async setUserBlocked(appointmentId: string, blocked: boolean) {
      return request<{ conversation: any }>(`/appointments/${appointmentId}/block`, { method: "PUT", body: JSON.stringify({ blocked }) });
    },
    async authorizeCall(appointmentId: string) {
      return request<{ allowed: boolean; callWindow: any }>(`/appointments/${appointmentId}/call/authorize`, { method: "POST" });
    },
  },

  // Companions
  companions: {
    async getSessionMessages(sessionId: string) {
      return request<{ messages: any[] }>(`/companion-sessions/${encodeURIComponent(sessionId)}/messages`);
    },
    async sendSessionMessage(sessionId: string, text: string) {
      return request<{ message: any; safety: any }>(`/companion-sessions/${encodeURIComponent(sessionId)}/messages`, { method: "POST", body: JSON.stringify({ text }) });
    },
    async list() {
      const res = await request<{ companions: any[] }>("/companions");
      return res.companions;
    },
    async requestVerification(panCard: string) {
      const res = await request<{ user: any }>("/companions/verify-request", {
        method: "POST",
        body: JSON.stringify({ panCard }),
      });
      return res.user;
    },
  },

  // Chat
  chat: {
    async getHistory(recipient?: string) {
      const query = recipient ? `?recipient=${encodeURIComponent(recipient)}` : "";
      return request<{ chats: any[]; activeSessionId?: string }>(`/chats${query}`);
    },

    async getSessionChats(sessionId: string) {
      if (!sessionId) return [];
      try {
        const res = await request<{ chats: any[] }>(`/chats?sessionId=${encodeURIComponent(sessionId)}`);
        return res.chats || [];
      } catch {
        return [];
      }
    },

    async sendMessage(data: { text: string; recipient?: string; lang?: string; sessionId?: string; isVoice?: boolean; audioUrl?: string; voiceDuration?: string | number }) {
      const res = await request<{
        userMessage: any;
        replyMessage: any;
        distressAlertTriggered?: boolean;
        freeTherapistVoucher?: any;
        distressWindow?: any;
        therapistConnection?: any;
        isCurrentMessageDistress?: boolean;
        currentMessageRiskLevel?: string;
      }>("/chats", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res;
    },

    async sendVoiceMessage(data: FormData | { audioData?: string; transcript?: string; recipient?: string; sessionId?: string }) {
      const res = await request<{
        userMessage: any;
        replyMessage: any;
        voiceResult: any;
        distressAlertTriggered?: boolean;
        freeTherapistVoucher?: any;
        distressWindow?: any;
        therapistConnection?: any;
        isCurrentMessageDistress?: boolean;
        currentMessageRiskLevel?: string;
      }>("/chats/voice", {
        method: "POST",
        body: data instanceof FormData ? data : JSON.stringify(data),
      });
      return res;
    },

    async deleteMessage(id: string) {
      const res = await request<{ message: string }>(`/chats/${id}`, {
        method: "DELETE",
      });
      return res;
    },
  },

  // AI Companion Settings & Memory
  ai: {
    async getProfile() {
      const res = await request<{ profile: any; lifeEvents: any[] }>("/ai/profile");
      return res;
    },
    async updateProfile(data: any) {
      const res = await request<{ profile: any }>("/ai/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return res.profile;
    },
    async addMemory(data: { category: string; content: string; date?: string }) {
      const res = await request<{ memory: any; profile: any }>("/ai/memories", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res;
    },
    async editMemory(memoryId: string, data: { category: string; content: string; date?: string }) {
      const res = await request<{ memory: any; profile: any }>(`/ai/memories/${memoryId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return res;
    },
    async deleteMemory(memoryId: string, action?: string) {
      const query = action ? `?action=${action}` : "";
      const res = await request<{ profile: any }>(`/ai/memories/${memoryId}${query}`, {
        method: "DELETE",
      });
      return res.profile;
    },
    async importChatHistory(data: { text: string; platform: string; consent: boolean; keepRaw?: boolean } | FormData) {
      const res = await request<{ message: string; importedCount: number; duplicateCount: number; profile: any }>("/ai/import", {
        method: "POST",
        body: data instanceof FormData ? data : JSON.stringify(data),
      });
      return res;
    },
    async deleteImportedHistory() {
      const res = await request<{ message: string; profile: any }>("/ai/import", {
        method: "DELETE",
      });
      return res.profile;
    },
    async setTherapistEscalationConsent(data: { appointmentId: string; consent: boolean }) {
      const res = await request<{ message: string; appointment: any }>("/ai/therapist-escalation/consent", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res;
    }
  },

  // Notifications
  notifications: {
    async list() {
      const res = await request<{ notifications: any[] }>("/notifications");
      return res.notifications;
    },

    async markRead(id: string) {
      const res = await request<{ notification: any }>(`/notifications/${id}/read`, {
        method: "PUT",
      });
      return res.notification;
    },

    async markAllRead() {
      const res = await request<{ notifications: any[] }>("/notifications/read-all", {
        method: "PUT",
      });
      return res.notifications;
    },

    async delete(id: string) {
      return request<{ message: string }>(`/notifications/${id}`, {
        method: "DELETE",
      });
    },

    async add(title: string, message: string, type?: string) {
      const res = await request<{ notification: any }>("/notifications", {
        method: "POST",
        body: JSON.stringify({ title, message, type }),
      });
      return res.notification;
    },
  },

  // User Settings
  settings: {
    async get() {
      const res = await request<{ notificationPreferences: any; privacySettings: any }>("/user/settings");
      return res;
    },
    async update(data: { notificationPreferences?: any; privacySettings?: any }) {
      const res = await request<{ notificationPreferences: any; privacySettings: any }>("/user/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return res;
    },
  },

  // Admin Namespace
  admin: {
    async listTherapists(search?: string, status?: string) {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (status) query.append("status", status);
      const res = await request<{ therapists: any[] }>(`/admin/therapists?${query.toString()}`);
      return res.therapists;
    },

    async updateTherapistStatus(id: string, status: string) {
      const res = await request<{ therapist: any }>(`/admin/therapists/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      return res.therapist;
    },

    async listCompanions(search?: string, verificationStatus?: string) {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (verificationStatus) query.append("verificationStatus", verificationStatus);
      const res = await request<{ companions: any[] }>(`/admin/companions/requests?${query.toString()}`);
      return res.companions;
    },

    async verifyCompanion(id: string, verify: boolean) {
      const res = await request<{ companion: any }>(`/admin/companions/${id}/verify`, {
        method: "PUT",
        body: JSON.stringify({ verify }),
      });
      return res.companion;
    },

    async listAuditLogs(search?: string, role?: string, status?: string, page = 1) {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (role) query.append("role", role);
      if (status) query.append("status", status);
      query.append("page", page.toString());
      return request<{ logs: any[]; total: number; pages: number; currentPage: number }>(`/admin/audit-logs?${query.toString()}`);
    },

    async getDashboardStats() {
      return request<any>("/admin/dashboard/stats");
    },

    async listEmergencyAlerts(status?: string) {
      const query = new URLSearchParams();
      if (status) query.append("status", status);
      const res = await request<{ alerts: any[] }>(`/admin/emergency-alerts?${query.toString()}`);
      return res.alerts;
    },

    async resolveEmergencyAlert(id: string, notes: string) {
      const res = await request<{ alert: any }>(`/admin/emergency-alerts/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      return res.alert;
    },

    async listUsers(search?: string, role?: string, country?: string, status?: string, page = 1, limit = 50) {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (role) query.append("role", role);
      if (country) query.append("country", country);
      if (status) query.append("status", status);
      query.append("page", page.toString());
      query.append("limit", limit.toString());
      const res = await request<{ users: any[]; total: number; pages: number; currentPage: number }>(`/admin/users?${query.toString()}`);
      return res;
    },

    async getStats() {
      return request<{ stats: any }>("/admin/stats");
    },
    async suspendUser(id: string) {
      return request<{ user: any }>(`/admin/users/${id}/suspend`, { method: "PUT" });
    },
    async blockUser(id: string, reason: string, category = "Policy Violation") {
      return request<{ user: any; message: string }>(`/admin/users/${id}/block`, {
        method: "POST",
        body: JSON.stringify({ userId: id, reason, category }),
      });
    },
    async unblockUser(id: string) {
      return request<{ user: any; message: string }>(`/admin/users/${id}/unblock`, { method: "POST" });
    },
    async activateUser(id: string) {
      return request<{ user: any }>(`/admin/users/${id}/activate`, { method: "PUT" });
    },
    async resetPassword(id: string) {
      return request<{ message: string }>(`/admin/users/${id}/reset-password`, { method: "PUT" });
    },
    async getReports() {
      return request<{ reports: any[] }>("/admin/reports");
    },
    async getUserProfile(id: string) {
      return request<{ user: any; moods: any[]; journals: any[]; payments: any[]; alerts: any[]; appointments: any[]; activity: any[] }>(`/admin/users/${id}/profile`);
    },
    async getRevenueStats() {
      return request<{
        totalRevenue: number; platformCommission: number; companionEarnings: number;
        subscriptionRevenue: number; therapistRevenue: number; totalGst: number;
        totalTransactions: number; todayRevenue: number; monthlyRevenue: number;
        growthPercent: number; pendingAmount: number; netRevenue: number;
        avgTransactionValue: number; typeBreakdown: any[]; recentTransactions: any[];
      }>("/admin/revenue/stats");
    },
    async getRevenueChart(period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
      return request<{ chartData: any[]; period: string }>(`/admin/revenue/chart?period=${period}`);
    },
    async getSystemSettings() {
      const res = await request<{ settings: any }>("/admin/settings");
      return res.settings;
    },
    async updateSystemSettings(settings: any) {
      const res = await request<{ settings: any }>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      return res.settings;
    },
    async listPayments(params?: { search?: string; type?: string; status?: string; page?: number; limit?: number; from?: string; to?: string; }) {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.type) q.set('type', params.type);
      if (params?.status) q.set('status', params.status);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      const qs = q.toString();
      return request<{ payments: any[]; total: number; pages: number; currentPage: number }>(`/admin/payments${qs ? '?' + qs : ''}`);
    },
    async listAppointments(params?: { search?: string; status?: string; paymentStatus?: string; refundStatus?: string; page?: number; limit?: number }) {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.paymentStatus) q.set('paymentStatus', params.paymentStatus);
      if (params?.refundStatus) q.set('refundStatus', params.refundStatus);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return request<{ appointments: any[]; total: number; pages: number; currentPage: number }>(`/admin/appointments${qs ? '?' + qs : ''}`);
    },
    async processRefund(appointmentId: string, reason?: string, amount?: number) {
      return request<{ message: string; appointment: any }>(`/admin/appointments/${appointmentId}/refund`, {
        method: "POST",
        body: JSON.stringify({ reason, amount }),
      });
    },
    async exportAppointmentsCSV(): Promise<Blob> {
      const url = `${API_BASE}/admin/appointments/export`;
      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(""),
      });
      if (!response.ok) {
        throw new ApiError("Failed to export appointments report", response.status);
      }
      return response.blob();
    },
  },

  // Dashboard Namespace
  dashboard: {
    async getOverview() {
      const res = await request<{ dashboard: any }>("/dashboard");
      return res.dashboard;
    },
  },

  // Crisis Namespace
  crisis: {
    async getContacts() {
      const res = await request<{ contacts: any[] }>("/crisis/contacts");
      return res.contacts;
    },

    async saveContact(data: {
      name: string;
      relationship: string;
      countryCode: string;
      phone: string;
      email?: string;
      priority?: number;
    }) {
      const res = await request<{ contact: any }>("/crisis/contacts", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.contact;
    },

    async getActiveSession() {
      return request<{ activeSession: any; activeCase: any }>("/crisis/active-session");
    },

    async getEmergencyMessages(sessionId: string) {
      return request<{ session: any; messages: any[] }>(`/emergency-sessions/${encodeURIComponent(sessionId)}/messages`);
    },

    async sendEmergencyMessage(sessionId: string, text: string) {
      return request<{ message: any; safety: any }>(`/emergency-sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },

    async triggerSOS() {
      return request<{ assignment: any }>("/crisis/sos", { method: "POST" });
    },
  },

  // Companion Matching Namespace
  matching: {
    async requestMatch(useFavorite?: boolean) {
      return request<{ session: any; isFav: boolean }>("/matching/request", {
        method: "POST",
        body: JSON.stringify({ useFavorite })
      });
    },

    async processPayment(sessionId: string, amount: number) {
      return request<{ session: any }>("/matching/payment", {
        method: "POST",
        body: JSON.stringify({ sessionId, amount })
      });
    },

    async endSession(data: {
      sessionId: string;
      durationMinutes: number;
      favorite?: boolean;
      blockReason?: string;
      reportReason?: string;
      rating?: number;
    }) {
      return request<{ message: string }>("/matching/end", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    async getStats() {
      return request<{ stats: any; favoritesCount: number }>("/matching/stats");
    },

    async getFavoriteStatus() {
      return request<{ hasFavorite: boolean; name?: string; isBusy?: boolean; companionId?: string }>("/matching/favorite-status");
    },

    async getDetailedStats() {
      return request<{ stats: any }>("/matching/detailed-stats");
    },
  },
  billing: {
    async getOverview() {
      return request<{ billing: any }>("/billing");
    },
  },
  payments: {
    async createOrder(data: { amount: number; type: string; targetId?: string; billingCycle?: "monthly" | "yearly" }) {
      return request<{ success: boolean; order: any; razorpayKeyId: string }>("/payments/order", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async verifyPayment(data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      type: string;
      targetId: string;
      amount: number;
      billingCycle?: "monthly" | "yearly";
    }) {
      return request<{ success: boolean; payment: any }>("/payments/verify", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },
  risk: {
    async reportLocation(lat: number, lng: number, accuracy?: number) {
      return request<{ message: string }>("/risk/report-location", {
        method: "POST",
        body: JSON.stringify({ lat, lng, accuracy })
      });
    },
    async getScore() {
      return request<{ score: number; level: string; activeSignals: any[]; lastAnalyzedAt: string }>("/risk/score");
    },
    async getEvents() {
      return request<{ events: any[] }>("/risk/events");
    },
    async resolveEvent(eventId: string, notes?: string, status?: string) {
      return request<{ message: string; event: any }>(`/risk/resolve/${eventId}`, {
        method: "POST",
        body: JSON.stringify({ notes, status })
      });
    },
  },
  referenceData: {
    async get(type?: string) {
      const query = type ? `?type=${encodeURIComponent(type)}` : "";
      return request<{ success: boolean; count: number; data: any[] }>(`/reference-data${query}`);
    },
  },
};
