import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  Users,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Star,
  Eye,
  Trash2,
  CheckCircle2,
  AlertOctagon,
  Search,
  Check,
  X,
  ShieldAlert,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  HeartHandshake,
  Clock,
  Settings,
  CreditCard,
  Wallet,
  IndianRupee,
  Receipt,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
  CalendarDays,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { socket } from '@/lib/socket';

function SLATimer({ alert }: { alert: any }) {
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isBreached, setIsBreached] = useState(false);

  useEffect(() => {
    if (alert.status !== 'active') return;

    const updateTimer = () => {
      const createdDate = new Date(alert.createdAt);
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - createdDate.getTime()) / 1000);
      const slaSeconds = (alert.slaMinutes || 15) * 60;
      const difference = slaSeconds - elapsedSeconds;

      if (difference <= 0) {
        setIsBreached(true);
        const breachedSeconds = Math.abs(difference);
        const mins = Math.floor(breachedSeconds / 60);
        const secs = breachedSeconds % 60;
        setTimeLeftStr(`SLA BREACHED by ${mins}m ${secs}s`);
      } else {
        setIsBreached(false);
        const mins = Math.floor(difference / 60);
        const secs = difference % 60;
        setTimeLeftStr(`SLA: ${mins}m ${secs}s left`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [alert]);

  if (alert.status !== 'active') {
    if (alert.slaBreach) {
      return (
        <span className="text-[9px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
          SLA Breached
        </span>
      );
    }
    const resolvedInSecs = alert.respondedAt 
      ? Math.floor((new Date(alert.respondedAt).getTime() - new Date(alert.createdAt).getTime()) / 1000)
      : null;
    return (
      <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
        Resolved {resolvedInSecs ? `in ${Math.floor(resolvedInSecs / 60)}m ${resolvedInSecs % 60}s` : "within SLA"}
      </span>
    );
  }

  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
      alert.slaBreach || isBreached 
        ? "bg-red-50 text-red-600 border-red-200 animate-pulse" 
        : "bg-amber-50 text-amber-600 border-amber-200"
    }`}>
      {timeLeftStr || "Calculating SLA..."}
    </span>
  );
}

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'therapists' | 'companions' | 'alerts' | 'audit' | 'analytics' | 'export' | 'settings' | 'revenue' | 'appointments'>('overview');

  useEffect(() => {
    if (location === "/admin/dashboard") setActiveTab("overview");
    else if (location === "/admin/users") setActiveTab("export");
    else if (location === "/admin/therapists") setActiveTab("therapists");
    else if (location === "/admin/companions") setActiveTab("companions");
    else if (location === "/admin/alerts") setActiveTab("alerts");
    else if (location === "/admin/audit-logs") setActiveTab("audit");
    else if (location === "/admin/settings") setActiveTab("settings");
    else if (location === "/admin/revenue") setActiveTab("revenue");
    else if (location === "/admin/appointments") setActiveTab("appointments");
  }, [location]);

  const { toast } = useToast();

  // Data states
  const [therapists, setTherapists] = useState<any[]>([]);
  const [companions, setCompanions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    weeklyActivityData: [],
    platformMoodData: [],
    monthlyTrendData: []
  });
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>({
    companionCommissionRate: 0.2,
    therapistCommissionRate: 0.15,
    freeTrialMinutes: 30,
    allowAnonymousSessions: true,
    maintenanceMode: false,
    emergencyHotline: '911'
  });

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  
  // Revenue-specific states
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentPages, setPaymentPages] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [txSearch, setTxSearch] = useState('');
  const [txType, setTxType] = useState('all');
  const [txStatus, setTxStatus] = useState('all');
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  
  // Resolution details
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // User Profile Drawer states
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);

  // Fetch functions
  const fetchUserProfile = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.admin.getUserProfile(id);
      setSelectedUserProfile(data);
      setIsUserDrawerOpen(true);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error fetching user profile",
        description: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Admin Appointments & Refunds state
  const [adminAppointments, setAdminAppointments] = useState<any[]>([]);
  const [apptTotal, setApptTotal] = useState(0);
  const [apptPages, setApptPages] = useState(1);
  const [apptPage, setApptPage] = useState(1);
  const [apptSearch, setApptSearch] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('ALL');
  const [apptPaymentFilter, setApptPaymentFilter] = useState('ALL');
  const [apptRefundFilter, setApptRefundFilter] = useState('ALL');
  const [selectedApptModal, setSelectedApptModal] = useState<any>(null);
  const [apptLoading, setApptLoading] = useState(false);

  const fetchAdminAppointments = async (page = apptPage) => {
    setApptLoading(true);
    try {
      const data = await api.admin.listAppointments({
        search: apptSearch || undefined,
        status: apptStatusFilter !== 'ALL' ? apptStatusFilter : undefined,
        paymentStatus: apptPaymentFilter !== 'ALL' ? apptPaymentFilter : undefined,
        refundStatus: apptRefundFilter !== 'ALL' ? apptRefundFilter : undefined,
        page,
        limit: 15,
      });
      setAdminAppointments(data.appointments || []);
      setApptTotal(data.total || 0);
      setApptPages(data.pages || 1);
      setApptPage(data.currentPage || 1);
    } catch (err: any) {
      console.error(err);
    } finally {
      setApptLoading(false);
    }
  };

  const handleAdminProcessRefund = async (appointmentId: string) => {
    const reason = prompt("Enter reason for manual refund processing:");
    if (!reason) return;
    try {
      await api.admin.processRefund(appointmentId, reason);
      toast({
        title: "Refund Processed 💳",
        description: "Refund completed successfully. User wallet/account credited.",
      });
      fetchAdminAppointments(apptPage);
      if (selectedApptModal && selectedApptModal._id === appointmentId) {
        setSelectedApptModal(null);
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Refund Action Failed",
        description: err.message || "Failed to process refund.",
      });
    }
  };

  const handleExportAppointmentsReport = async () => {
    try {
      const blob = await api.admin.exportAppointmentsCSV();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `appointments_full_report_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Report Exported", description: "Appointments & refunds report downloaded." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message || "Could not export report." });
    }
  };

  const fetchTherapists = async () => {
    setIsLoading(true);
    try {
      const statusFilter = filterStatus === 'all' ? undefined : filterStatus;
      const data = await api.admin.listTherapists(searchQuery || undefined, statusFilter);
      setTherapists(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRevenueStats = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getRevenueStats();
      setRevenueStats(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRevenueChart = async (period: 'daily' | 'weekly' | 'monthly' = chartPeriod) => {
    setChartLoading(true);
    try {
      const data = await api.admin.getRevenueChart(period);
      setChartData(data.chartData || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchAllPayments = async (page = paymentPage) => {
    setTxLoading(true);
    try {
      const data = await api.admin.listPayments({
        search: txSearch || undefined,
        type: txType !== 'all' ? txType : undefined,
        status: txStatus !== 'all' ? txStatus : undefined,
        page,
        limit: 15,
      });
      setAllPayments(data.payments);
      setPaymentTotal(data.total);
      setPaymentPages(data.pages);
      setPaymentPage(data.currentPage);
    } catch (err: any) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  };

  const fetchCompanions = async () => {
    setIsLoading(true);
    try {
      const statusFilter = filterStatus === 'all' ? undefined : filterStatus;
      const data = await api.admin.listCompanions(searchQuery || undefined, statusFilter);
      setCompanions(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.listEmergencyAlerts(filterStatus === 'all' ? undefined : filterStatus);
      setAlerts(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.listAuditLogs(searchQuery || undefined, undefined, filterStatus === 'all' ? undefined : filterStatus, logPage);
      setAuditLogs(data.logs);
      setLogPages(data.pages);
      setLogTotal(data.total);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.listUsers(
        searchQuery || undefined,
        undefined,
        undefined,
        filterStatus === 'all' ? undefined : filterStatus,
        userPage
      );
      setUsers(data.users);
      setUserPages(data.pages);
      setUserTotal(data.total);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSystemSettings = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getSystemSettings();
      if (data) {
        setSystemSettings(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      await api.admin.updateSystemSettings(systemSettings);
      toast({
        title: "Settings Saved",
        description: "Platform settings updated successfully.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error saving settings",
        description: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendUser = async (id: string) => {
    try {
      await api.admin.suspendUser(id);
      toast({
        title: "User Suspended",
        description: "The user account status has been updated to suspended.",
      });
      fetchUsers();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to suspend user."
      });
    }
  };

  const handleBlockUser = async (id: string) => {
    const reason = window.prompt("Enter the reason for restricting this account:");
    if (!reason?.trim()) return;
    try {
      await api.admin.blockUser(id, reason.trim());
      toast({ title: "Account Restricted", description: "The account and its active sessions have been disabled." });
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Restriction failed", description: err.message || "Unable to restrict this account." });
    }
  };

  const handleUnblockUser = async (id: string) => {
    try {
      await api.admin.unblockUser(id);
      toast({ title: "Account Restored", description: "The account can sign in again." });
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Restore failed", description: err.message || "Unable to restore this account." });
    }
  };

  const handleActivateUser = async (id: string) => {
    try {
      await api.admin.activateUser(id);
      toast({
        title: "User Activated",
        description: "The user account status has been updated to active.",
      });
      fetchUsers();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to activate user."
      });
    }
  };

  const handleResetPassword = async (id: string) => {
    try {
      await api.admin.resetPassword(id);
      toast({
        title: "Password Reset Success",
        description: "The user password has been reset. A temporary password will be emailed.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to reset password."
      });
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchAlerts();
      fetchStats();
      fetchTherapists();
      fetchUsers();
    }
    if (activeTab === 'therapists') fetchTherapists();
    if (activeTab === 'companions') {
      fetchCompanions();
      fetchSystemSettings();
    }
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'export') fetchUsers();
    if (activeTab === 'revenue') {
      fetchRevenueStats();
      fetchRevenueChart(chartPeriod);
      fetchAllPayments(1);
    }
    if (activeTab === 'appointments') {
      fetchAdminAppointments(1);
    }
    if (activeTab === 'settings') fetchSystemSettings();
  }, [activeTab, searchQuery, filterStatus, logPage, userPage, apptSearch, apptStatusFilter, apptPaymentFilter, apptRefundFilter]);

  // Socket.io connection for real-time emergency notifications
  useEffect(() => {
    socket.connect();
    
    // Join the admin room
    socket.emit("join_admin");

    // Listen for new emergency alerts
    socket.on("new_emergency_alert", (newAlert: any) => {
      setAlerts((prev) => {
        if (prev.some((a: any) => a._id === newAlert._id)) return prev;
        return [newAlert, ...prev];
      });
      
      toast({
        variant: "destructive",
        title: "🚨 CRISIS INCIDENT DETECTED",
        description: `Active emergency case triggered for ${newAlert.userName}.`,
      });
    });

    // Listen for alerts updated (e.g. status resolved or SLA breach flagged by cron)
    socket.on("emergency_alert_updated", (updatedAlert: any) => {
      setAlerts((prev) => 
        prev.map((a: any) => (a._id === updatedAlert._id ? updatedAlert : a))
      );
    });

    return () => {
      socket.off("new_emergency_alert");
      socket.off("emergency_alert_updated");
      socket.disconnect();
    };
  }, []);

  // Actions
  const handleUpdateTherapistStatus = async (id: string, newStatus: string) => {
    try {
      await api.admin.updateTherapistStatus(id, newStatus);
      toast({
        title: "Status Updated",
        description: `Therapist registration is now updated to: ${newStatus}`,
      });
      fetchTherapists();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to update therapist status."
      });
    }
  };

  const handleVerifyCompanion = async (id: string, approve: boolean) => {
    try {
      await api.admin.verifyCompanion(id, approve);
      toast({
        title: "Companion status updated",
        description: approve ? "Companion verified successfully." : "Verification declined."
      });
      fetchCompanions();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to resolve request."
      });
    }
  };

  const handleResolveAlert = async () => {
    if (!resolvingAlertId) return;
    try {
      await api.admin.resolveEmergencyAlert(resolvingAlertId, resolutionNotes);
      toast({
        title: "Case Resolved",
        description: "Emergency incident has been successfully resolved and archived.",
      });
      setResolvingAlertId(null);
      setResolutionNotes('');
      fetchAlerts();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to resolve alert."
      });
    }
  };

  const handleExportPayments = async () => {
    setIsLoading(true);
    try {
      const rawPayments = await api.admin.listPayments();
      const flattened = (rawPayments.payments || []).map((p: any) => ({
        "Transaction ID": p._id,
        "User Name": p.userId?.name || "Unknown",
        "User Email": p.userId?.email || "Unknown",
        "Type": p.type,
        "Description": p.description || "",
        "Invoice Number": p.invoiceNumber || "",
        "Amount (INR)": p.amount,
        "Platform Commission (INR)": p.platformCommission,
        "Companion Earnings (INR)": p.companionEarnings,
        "GST (INR)": p.gst,
        "Status": p.status,
        "Date": new Date(p.createdAt).toLocaleString()
      }));
      downloadCSV(flattened, "payments_report");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: err.message || "Failed to export payment history."
      });
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Export utility
  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no records in the table to download."
      });
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(','))
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout variant="admin">
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-0.5">Admin Dashboard</h1>
            <p className="text-xs text-gray-400 font-bold">Platform overview and management.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-full font-bold px-3.5 py-1 text-[11px] uppercase tracking-wider">
              Admin Panel
            </Badge>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 flex-wrap border-b border-gray-100 dark:border-zinc-900 pb-3">
          {[
            { id: 'overview', label: 'Platform Stats', icon: TrendingUp, href: "/admin/dashboard" },
            { id: 'therapists', label: 'Therapist Reviews', icon: ShieldCheck, href: "/admin/therapists" },
            { id: 'companions', label: 'Companion Badges', icon: HeartHandshake, href: "/admin/companions" },
            { id: 'appointments', label: 'Appointments & Refunds', icon: Calendar, href: "/admin/appointments" },
            { id: 'alerts', label: 'Emergency Alerts', icon: AlertOctagon, href: "/admin/alerts" },
            { id: 'audit', label: 'Audit Logs', icon: Database, href: "/admin/audit-logs" },
            { id: 'export', label: 'User Directory', icon: Users, href: "/admin/users" },
            { id: 'revenue', label: 'Payments & Revenue', icon: FileSpreadsheet, href: "/admin/revenue" },
            { id: 'settings', label: 'Platform Settings', icon: Settings, href: "/admin/settings" }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setLocation(t.href);
                setSearchQuery('');
                setFilterStatus('all');
                setLogPage(1);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                activeTab === t.id
                  ? 'bg-red-600/10 text-red-700 border-red-200/50 shadow-[0_2px_10px_rgba(220,38,38,0.03)]'
                  : 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-50/50'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "TOTAL USERS", value: (stats.stats?.totalUsers ?? 0).toLocaleString(), change: `${stats.stats?.weeklyRegistrations ?? 0} registered this week`, icon: Users, color: "text-blue-500", bgIcon: "bg-blue-500/10" },
                { label: "ACTIVE CHATS", value: (stats.stats?.onlineUsers ?? 0).toLocaleString(), change: "Activity in the last 5 minutes", icon: MessageSquare, color: "text-emerald-500", bgIcon: "bg-emerald-500/10" },
                { label: "VERIFIED THERAPISTS", value: (stats.stats?.approvedTherapists ?? 0).toLocaleString(), change: `${stats.stats?.pendingTherapists ?? 0} pending review`, icon: ShieldCheck, color: "text-green-500", bgIcon: "bg-green-500/10" },
                { label: "TOTAL REVENUE", value: `₹${(stats.stats?.totalRevenue ?? 0).toLocaleString('en-IN')}`, change: `${stats.stats?.totalTransactions ?? 0} transactions`, icon: TrendingUp, color: "text-purple-500", bgIcon: "bg-purple-500/10" },
                { label: "APPOINTMENTS", value: (stats.stats?.totalAppointments ?? 0).toLocaleString(), change: `${stats.stats?.completedConsultations ?? 0} completed`, icon: Calendar, color: "text-cyan-500", bgIcon: "bg-cyan-500/10" },
                { label: "PENDING APPROVAL", value: (stats.stats?.pendingApprovals ?? 0).toLocaleString(), change: "Awaiting therapist action", icon: Clock, color: "text-amber-500", bgIcon: "bg-amber-500/10" },
                { label: "EMERGENCY ALERTS", value: (stats.stats?.activeEmergencyAlerts ?? 0).toLocaleString(), change: "Active clinical cases", icon: AlertOctagon, color: "text-red-500", bgIcon: "bg-red-500/10" },
                { label: "PATIENT REVIEWS", value: Number(stats.stats?.averageRating ?? 0).toFixed(1), change: `${stats.stats?.totalReviews ?? 0} verified reviews`, icon: Star, color: "text-violet-500", bgIcon: "bg-violet-500/10" }
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-gray-100/90 dark:border-zinc-900/50 p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{s.label}</p>
                    <div className={`p-1.5 rounded-xl ${s.bgIcon}`}>
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-zinc-100 leading-none">{s.value}</p>
                  <p className="text-[10px] font-bold mt-2 text-gray-400 truncate">{s.change}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-5">
                <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Weekly Activity</h3>
                    <select className="text-[10px] text-gray-500 border border-gray-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 rounded-full px-3 py-1 outline-none">
                      <option>This Week</option>
                    </select>
                  </div>
                  <div className="h-64">
                    {!stats.weeklyActivityData?.length ? <div className="h-full flex items-center justify-center text-xs text-gray-400">No activity data available.</div> : <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.weeklyActivityData} margin={{ top: 5, right: 10, bottom: 5, left: -25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.01)' }} />
                        <Bar dataKey="users" fill="#158754" radius={[4,4,0,0]} barSize={16} />
                        <Bar dataKey="sessions" fill="#93c5fd" radius={[4,4,0,0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>}
                  </div>
                </div>
              </div>

              {/* Pending Verifications queue card */}
              <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Pending Verifications</h3>
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold text-xs px-2.5 py-0.5 rounded-full">
                    {stats.stats?.pendingTherapists ?? 0}
                  </Badge>
                </div>
                
                <div className="space-y-3 overflow-y-auto max-h-[16.5rem] pr-1">
                  {therapists.filter(t => t.status === 'pending').length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 font-medium border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
                      No pending therapist verifications at this time.
                    </div>
                  ) : (
                    therapists.filter(t => t.status === 'pending').map((t) => (
                      <div key={t._id} className="bg-gray-50/50 dark:bg-zinc-900/20 border border-gray-100/85 dark:border-zinc-900/30 rounded-2xl p-4 space-y-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{t.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">{t.name}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{t.email}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5 font-medium">Applied: {new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleUpdateTherapistStatus(t._id, 'approved')} 
                            size="sm" 
                            className="flex-1 bg-[#158754] hover:bg-[#158754]/95 text-white text-[10px] rounded-xl h-8 font-bold gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button 
                            onClick={() => handleUpdateTherapistStatus(t._id, 'rejected')} 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 border-red-200 dark:border-red-900/40 text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 text-[10px] rounded-xl h-8 font-semibold"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> Platform Wellbeing Trend</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Average wellness score from submitted mood check-ins.</p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-0 text-[10px] font-bold">Live analytics</Badge>
                </div>
                <div className="h-56">
                  {!stats.monthlyTrendData?.length ? <div className="h-full flex items-center justify-center text-xs text-gray-400">No mood trend data available.</div> : <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.monthlyTrendData} margin={{ top: 5, right: 12, bottom: 5, left: -20 }}>
                      <defs><linearGradient id="adminWellbeingGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)} / 100`, 'Average score']} />
                      <Area type="monotone" dataKey="avgScore" stroke="#10b981" strokeWidth={3} fill="url(#adminWellbeingGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>}
                </div>
              </div>

              <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5">
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm flex items-center gap-2 mb-1"><PieChartIcon className="w-4 h-4 text-violet-500" /> Mood Distribution</h3>
                <p className="text-[10px] text-gray-400 mb-3">Aggregated platform check-ins</p>
                <div className="h-44">
                  {!stats.platformMoodData?.length ? <div className="h-full flex items-center justify-center text-xs text-gray-400">No mood data available.</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.platformMoodData} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3}>{stats.platformMoodData.map((entry: any, index: number) => <Cell key={`${entry.name}-${index}`} fill={entry.color || '#94a3b8'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}
                </div>
                <div className="space-y-1.5 border-t border-gray-100 dark:border-zinc-900 pt-3">
                  {(stats.platformMoodData || []).map((item: any) => <div key={item.name} className="flex items-center justify-between text-[10px]"><span className="flex items-center gap-1.5 text-gray-500"><i className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />{item.name}</span><span className="font-bold text-gray-700 dark:text-zinc-300">{item.value}</span></div>)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Recent Users */}
              <div className="xl:col-span-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Recent Users</h3>
                  <Button 
                    onClick={() => setLocation("/admin/users")} 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full text-xs border-gray-200 dark:border-zinc-800 font-semibold px-4 h-8 hover:bg-gray-50 dark:hover:bg-zinc-900/50 bg-white/85"
                  >
                    View All
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {users.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 font-medium border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
                      No user accounts found.
                    </div>
                  ) : (
                    users.slice(0, 3).map((u) => (
                      <div key={u._id} className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-zinc-900/20 border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl cursor-pointer shadow-sm" onClick={() => fetchUserProfile(u._id)}>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{u.name ? u.name[0] : 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">{u.name || "Anonymous User"}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                          <Badge className={`border-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            u.status === 'suspended' ? 'bg-red-600/10 text-red-700' : 'bg-green-600/10 text-green-700 dark:text-green-300'
                          }`}>
                            {u.status === 'suspended' ? 'Suspended' : 'Active'}
                          </Badge>
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => fetchUserProfile(u._id)}
                              variant="ghost" 
                              size="icon" 
                              className="w-7 h-7 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900"
                            >
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                            <Button 
                              onClick={() => handleSuspendUser(u._id)}
                              variant="ghost" 
                              size="icon" 
                              className="w-7 h-7 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5 space-y-4">
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Quick Stats</h3>
                <div className="divide-y divide-gray-100 dark:divide-zinc-900">
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">Crisis Alerts Today</span>
                    <span className="text-xs font-black text-red-500">{stats.stats?.activeEmergencyAlerts ?? 0}</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">Avg. Session Duration</span>
                    <span className="text-xs font-black text-blue-500">{stats.stats?.completedConsultations ?? 0} completed</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">User Satisfaction</span>
                    <span className="text-xs font-black text-green-600">{Number(stats.stats?.averageRating ?? 0).toFixed(1)} / 5</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">System Health Status</span>
                    <span className="text-xs font-black text-primary">● {stats.stats?.systemStatus ?? 'Unavailable'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Therapists Review Tab */}
        {activeTab === 'therapists' && (
          <div className="space-y-4">
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.02)] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search therapists name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 min-w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Applications</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchTherapists} size="sm" variant="outline" className="rounded-xl border-gray-200 dark:border-zinc-800">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-900">
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Registration Applications</h3>
              </div>
              
              {isLoading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading therapists...</div>
              ) : therapists.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">No therapist applications found.</div>
              ) : (
                <div className="divide-y divide-gray-100/80 dark:divide-zinc-900/50">
                  {therapists.map((t) => (
                    <div key={t._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/30 dark:hover:bg-zinc-900/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                            {t.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">{t.name}</span>
                            <Badge className={`border-0 text-[10px] uppercase font-semibold ${
                              t.status === 'approved' ? 'bg-green-600/10 text-green-700 dark:text-green-300' :
                              t.status === 'pending' ? 'bg-amber-600/10 text-amber-700 dark:text-amber-300' : 'bg-red-600/10 text-red-700 dark:text-red-300'
                            }`}>
                              {t.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">{t.email} · {t.phone || "No phone number"}</p>
                          {t.panNumber && <p className="text-[11px] text-gray-500 dark:text-zinc-400">PAN: {t.panNumber}</p>}
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold">Applied: {new Date(t.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        {t.status === 'pending' && (
                          <>
                            <Button
                              onClick={() => handleUpdateTherapistStatus(t._id, 'approved')}
                              size="sm"
                              className="rounded-xl bg-green-600 text-white hover:bg-green-700 text-xs px-3 h-8 gap-1 font-bold"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </Button>
                            <Button
                              onClick={() => handleUpdateTherapistStatus(t._id, 'rejected')}
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs px-3 h-8 gap-1 font-semibold"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {t.status === 'approved' && (
                          <Button
                            onClick={() => handleUpdateTherapistStatus(t._id, 'suspended')}
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-amber-200 dark:border-amber-900/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-xs px-3 h-8 gap-1 font-semibold"
                          >
                            <X className="w-3.5 h-3.5" /> Suspend
                          </Button>
                        )}
                        {t.status === 'suspended' && (
                          <Button
                            onClick={() => handleUpdateTherapistStatus(t._id, 'approved')}
                            size="sm"
                            className="rounded-xl bg-primary text-white hover:bg-primary/95 text-xs px-3 h-8 gap-1 font-bold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Companions Badge Reviews */}
        {activeTab === 'companions' && (
          <div className="space-y-4">
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.02)] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search companions name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 min-w-[120px]">
                    <SelectValue placeholder="Verification Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Verification States</SelectItem>
                    <SelectItem value="pending">Pending Verification</SelectItem>
                    <SelectItem value="verified">Verified Badge Added</SelectItem>
                    <SelectItem value="rejected">Rejected Requests</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchCompanions} size="sm" variant="outline" className="rounded-xl border-gray-200 dark:border-zinc-800">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-900">
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Companion Verification Queue</h3>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading requests...</div>
              ) : companions.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">No companion requests found.</div>
              ) : (
                <div className="divide-y divide-gray-100/80 dark:divide-zinc-900/50">
                  {companions.map((c) => (
                    <div key={c._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/30 dark:hover:bg-zinc-900/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                            {c.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">{c.name}</span>
                            {c.verifiedCompanion && (
                              <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-600/20 text-[10px] font-bold">
                                ✔ Verified Companion
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{c.email}</p>
                          <p className="text-[11px] text-gray-400 font-bold">
                            Request Status: <span className="capitalize text-amber-600">{c.companionVerificationStatus}</span>
                          </p>
                          {c.panCard && (
                            <p className="text-[11px] text-gray-400 font-bold">
                              PAN Card: <span className="font-mono text-gray-700 dark:text-zinc-300">{c.panCard}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        {c.companionVerificationStatus === 'pending' && (
                          <>
                            <Button
                              onClick={() => handleVerifyCompanion(c._id, true)}
                              size="sm"
                              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs px-3 h-8 gap-1 font-bold"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve Badge
                            </Button>
                            <Button
                              onClick={() => handleVerifyCompanion(c._id, false)}
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs px-3 h-8 gap-1 font-semibold"
                            >
                              <X className="w-3.5 h-3.5" /> Decline Request
                            </Button>
                          </>
                        )}
                        {c.companionVerificationStatus === 'verified' && (
                          <Button
                            onClick={() => handleVerifyCompanion(c._id, false)}
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs px-3 h-8 gap-1 font-semibold"
                          >
                            Revoke Badge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Configurator rules widgets */}
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-6 space-y-4 mt-6">
              <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Milestone Rewards & Penalties Configurator</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Free Trial Limit (Minutes)</label>
                  <input 
                    type="number"
                    value={systemSettings?.freeTrialMinutes || 5} 
                    onChange={(e) => setSystemSettings({...systemSettings, freeTrialMinutes: parseInt(e.target.value)})}
                    className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-gray-50/50 dark:bg-zinc-900/30 outline-none focus:border-primary" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Minimum Rate (Per Min)</label>
                  <input defaultValue="₹0.50" disabled className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-gray-50/20 text-gray-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Maximum Rate (Per Min)</label>
                  <input defaultValue="₹15.00" disabled className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-gray-50/20 text-gray-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Platform Commission (%)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={systemSettings?.companionCommissionRate || 0.2}
                    onChange={(e) => setSystemSettings({...systemSettings, companionCommissionRate: parseFloat(e.target.value)})}
                    className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-gray-50/50 dark:bg-zinc-900/30 outline-none focus:border-primary" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-100 dark:border-zinc-900 rounded-2xl p-4 bg-gray-50/50 dark:bg-zinc-900/20">
                  <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">Milestone Tiers Rate Config</p>
                  <div className="space-y-2 mt-2 text-xs text-gray-500 dark:text-zinc-400 font-medium">
                    <div className="flex justify-between"><span>0 - 1000 hours</span><span>₹0.50 / min</span></div>
                    <div className="flex justify-between border-t border-gray-100/80 dark:border-zinc-900 pt-1.5"><span>1001 - 1500 hours</span><span>₹1.00 / min</span></div>
                    <div className="flex justify-between border-t border-gray-100/80 dark:border-zinc-900 pt-1.5"><span>1501 - 2500 hours</span><span>₹2.00 / min</span></div>
                    <div className="flex justify-between border-t border-gray-100/80 dark:border-zinc-900 pt-1.5"><span>2501 - 4000 hours</span><span>₹3.50 / min</span></div>
                  </div>
                </div>
                <div className="border border-gray-100 dark:border-zinc-900 rounded-2xl p-4 bg-gray-50/50 dark:bg-zinc-900/20">
                  <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">Performance Assessment Factors</p>
                  <div className="space-y-2 mt-2 text-[11px] text-gray-400 font-medium leading-relaxed">
                    <p>● <strong>Poor Availability (Offline):</strong> Downgrades milestone tier by one level.</p>
                    <p>● <strong>High Availability & 4.5+ Rating:</strong> Retains / Increases milestone tier.</p>
                    <p>● <strong>Weekly Assessment:</strong> Automation checks executed Sundays at 00:00.</p>
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleSaveSettings}
                disabled={isLoading}
                size="sm" 
                className="bg-primary hover:bg-primary/95 text-white text-xs rounded-xl h-9 font-bold"
              >
                Save Matching Configuration
              </Button>
            </div>
          </div>
        )}

        {/* Emergency alerts */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.02)] p-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Active Crisis Monitoring Queue</h3>
              <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val)}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 min-w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cases</SelectItem>
                  <SelectItem value="active">Active Alerts</SelectItem>
                  <SelectItem value="resolved">Resolved Cases</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading incident cases...</div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No critical emergency incidents logged.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((a) => (
                  <motion.div
                    key={a._id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white/80 dark:bg-zinc-950/80 rounded-3xl border p-5 shadow-[0_8px_30px_rgba(25,135,84,0.025)] space-y-4 ${
                      a.status === 'active' ? 'border-red-500/20 bg-red-500/5' : 'border-gray-100/90 dark:border-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">{a.userName}</h4>
                          <Badge className="bg-red-500 text-white border-0 text-[10px] font-extrabold animate-pulse">
                            CRITICAL RISK
                          </Badge>
                          <SLATimer alert={a} />
                        </div>
                        <p className="text-[10px] text-gray-400">Trigger: {a.detectedTrigger}</p>
                      </div>
                      <Badge className={`text-[10px] font-bold border-0 ${
                        a.status === 'active' ? 'bg-red-600/10 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-zinc-900 text-gray-500'
                      }`}>
                        {a.status}
                      </Badge>
                    </div>

                    <div className="bg-gray-50/50 dark:bg-zinc-900/30 p-3 rounded-xl border border-gray-100/80 dark:border-zinc-900/20 text-xs text-gray-600 dark:text-zinc-400 font-medium italic">
                      "{a.messageContent}"
                    </div>

                    {a.status === 'active' ? (
                      <div className="flex flex-col gap-2">
                        {resolvingAlertId === a._id ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="Enter resolution notes..."
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              className="text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 focus:border-primary outline-none"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={handleResolveAlert}
                                size="sm"
                                className="flex-1 rounded-xl bg-green-600 text-white text-xs h-8 font-bold"
                              >
                                Save & Resolve
                              </Button>
                              <Button
                                onClick={() => setResolvingAlertId(null)}
                                size="sm"
                                variant="outline"
                                className="flex-1 rounded-xl border-gray-200 dark:border-zinc-800 text-xs h-8 font-semibold"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setResolvingAlertId(a._id)}
                            size="sm"
                            className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs h-8 gap-1 font-bold"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Resolve Case
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 font-semibold bg-gray-50/50 dark:bg-zinc-900/30 p-2.5 rounded-xl border border-gray-100/80 dark:border-zinc-900/20">
                        Resolved Notes: {a.resolutionNotes}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log view */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.02)] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search logs by action or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 min-w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchAuditLogs} size="sm" variant="outline" className="rounded-xl border-gray-200 dark:border-zinc-800">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-900 bg-gray-50/40 dark:bg-zinc-900/30 text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/80 dark:divide-zinc-900/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">Loading audit trail...</td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">No logs found matching terms.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50/30 dark:hover:bg-zinc-900/20 transition-colors">
                        <td className="p-3 text-gray-400 shrink-0 font-medium whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-zinc-200">{log.userName}</p>
                            <p className="text-[10px] text-gray-400">{log.userEmail}</p>
                          </div>
                        </td>
                        <td className="p-3 capitalize font-bold text-gray-500 dark:text-zinc-400">{log.role}</td>
                        <td className="p-3"><Badge className="bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 text-[10px] font-bold uppercase border-0">{log.action}</Badge></td>
                        <td className="p-3">
                          <span className={`font-extrabold ${log.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 dark:text-zinc-400 min-w-[200px] max-w-sm truncate">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {logPages > 1 && (
              <div className="flex items-center justify-between p-2">
                <span className="text-xs text-gray-400 font-semibold">Total Logs: {logTotal}</span>
                <div className="flex gap-2">
                  <Button
                    disabled={logPage === 1}
                    onClick={() => setLogPage(p => p - 1)}
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-gray-200 dark:border-zinc-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    disabled={logPage === logPages}
                    onClick={() => setLogPage(p => p + 1)}
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-gray-200 dark:border-zinc-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mood Analytics deep charts view */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Line chart mood trend */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800 text-sm">Monthly Platform Mood & Stress Score</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="avgScore" name="Avg Mood Index" stroke="hsl(var(--primary))" strokeWidth={2} />
                      <Line type="monotone" dataKey="stress" name="Stress Level" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Area chart happiness indicators */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800 text-sm">Patient Progress Recovery Index</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="avgScore" fill="#dbeafe" stroke="#3b82f6" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie chart emotion layout */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center space-y-4">
                <h3 className="font-bold text-gray-800 text-sm w-full text-left">Overall Emotional Distribution</h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.platformMoodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.platformMoodData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 flex-wrap justify-center">
                  {stats.platformMoodData.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name} ({d.value}%)
                    </div>
                  ))}
                </div>
              </div>

              {/* Static stats info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 flex flex-col justify-center">
                <h3 className="font-bold text-gray-800 text-sm">Key Quality Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Depression Recovery", value: "84.2%" },
                    { label: "Anxiety Relief Ratio", value: "76.8%" },
                    { label: "Average Wellness Index", value: "78 / 100" },
                    { label: "User Retention Score", value: "92.5%" }
                  ].map((m, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5 space-y-4">
              <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Data Report Center</h3>
              <p className="text-xs text-gray-500">Export database collection tables directly into CSV spreadsheets.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: "Registered Users", desc: "List of all platform users, ages, and locales.", onClick: () => downloadCSV(users, "users_report") },
                  { title: "Review Application Logs", desc: "Audit logs showing login records and actions.", onClick: () => downloadCSV(auditLogs, "audit_logs_report") },
                  { title: "Therapists Review Data", desc: "Approved and pending therapist accounts list.", onClick: () => downloadCSV(therapists, "therapists_report") },
                  { title: "Critical Emergency Incident Logs", desc: "Emergency cases queue history database.", onClick: () => downloadCSV(alerts, "emergency_cases_report") },
                  { title: "Financial Transactions Ledger", desc: "Complete platform revenue ledger and payout details.", onClick: handleExportPayments }
                ].map((item, i) => (
                  <div key={i} className="border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl p-4 bg-gray-50/50 dark:bg-zinc-900/20 space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">{item.title}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                    <Button
                      onClick={item.onClick}
                      size="sm"
                      className="w-full bg-primary hover:bg-primary/95 text-white text-xs rounded-xl h-8 gap-1.5 font-bold"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Export to CSV
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* User Directory Management */}
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">User Directory & Status Management</h3>
                  <p className="text-xs text-gray-400">Search, suspend, activate, and manage passwords of registered users.</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800 w-full sm:w-48 bg-white/80 dark:bg-zinc-950/80"
                  />
                  <Button onClick={fetchUsers} size="sm" variant="outline" className="rounded-xl border-gray-200 dark:border-zinc-800">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-gray-100/80 dark:divide-zinc-900/50">
                {users.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">No users found matching search query.</div>
                ) : (
                  users.map((u) => (
                    <div 
                      key={u._id} 
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/30 dark:hover:bg-zinc-900/20 transition-colors cursor-pointer"
                      onClick={() => fetchUserProfile(u._id)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {u.name ? u.name[0] : "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 dark:text-zinc-200 text-xs">{u.name || "Anonymous User"}</span>
                            <Badge className="bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-0 text-[9px] uppercase font-extrabold px-2 py-0.5">
                              {u.role || "user"}
                            </Badge>
                            <Badge className={`border-0 text-[9px] uppercase font-extrabold px-2 py-0.5 ${
                              ['suspended', 'blocked', 'rejected'].includes(u.status) ? 'bg-red-600/10 text-red-700 dark:text-red-300' : 'bg-green-600/10 text-green-700 dark:text-green-300'
                            }`}>
                              {u.status || "approved"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{u.email} · {u.phone || "No phone number"} · {u.country || "IN"}</p>
                          {u.panNumber && <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">PAN: {u.panNumber}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                        {u.status === 'blocked' ? (
                          <Button
                            onClick={() => handleUnblockUser(u._id)}
                            size="sm"
                            className="rounded-xl bg-green-600 text-white hover:bg-green-700 text-[10px] px-3 h-7 font-bold"
                          >
                            Restore Access
                          </Button>
                        ) : u.status === 'suspended' ? (
                          <Button
                            onClick={() => handleActivateUser(u._id)}
                            size="sm"
                            className="rounded-xl bg-green-600 text-white hover:bg-green-700 text-[10px] px-3 h-7 font-bold"
                          >
                            Activate Account
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSuspendUser(u._id)}
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-[10px] px-3 h-7 font-bold"
                          >
                            Suspend
                          </Button>
                        )}
                        {u.status !== 'blocked' && (
                          <Button
                            onClick={() => handleBlockUser(u._id)}
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-red-300 dark:border-red-900/50 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-[10px] px-3 h-7 font-bold"
                          >
                            Block
                          </Button>
                        )}
                        <Button
                          onClick={() => handleResetPassword(u._id)}
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 text-[10px] px-3 h-7 font-semibold"
                        >
                          Reset Pass
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {userPages > 1 && (
                <div className="p-4 border-t border-gray-100 dark:border-zinc-900 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50 dark:bg-zinc-900/20">
                  <span className="font-semibold">Showing Page {userPage} of {userPages} ({userTotal} total users)</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 border-gray-200 dark:border-zinc-800"
                      disabled={userPage === 1}
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-bold text-gray-700 dark:text-zinc-300">{userPage}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 px-2 border-gray-200 dark:border-zinc-800"
                      disabled={userPage === userPages}
                      onClick={() => setUserPage(p => Math.min(userPages, p + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Revenue Tab */}
        {activeTab === 'revenue' && (() => {
          // KPI cards config
          const kpis = [
            {
              label: 'Total Revenue', value: revenueStats?.totalRevenue ?? 0,
              sub: `${revenueStats?.totalTransactions ?? 0} transactions`,
              icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20',
              trend: revenueStats?.growthPercent ?? 0,
            },
            {
              label: 'Platform Commission', value: revenueStats?.platformCommission ?? 0,
              sub: 'Net earnings (20%)',
              icon: Database, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20',
              trend: null,
            },
            {
              label: 'Companion Earnings', value: revenueStats?.companionEarnings ?? 0,
              sub: 'Disbursed to companions',
              icon: HeartHandshake, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20',
              trend: null,
            },
            {
              label: 'Subscription Revenue', value: revenueStats?.subscriptionRevenue ?? 0,
              sub: 'Premium plan payments',
              icon: Star, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20',
              trend: null,
            },
            {
              label: "Today's Revenue", value: revenueStats?.todayRevenue ?? 0,
              sub: 'Last 24 hours',
              icon: CalendarDays, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20',
              trend: null,
            },
            {
              label: 'This Month', value: revenueStats?.monthlyRevenue ?? 0,
              sub: 'Month to date',
              icon: BarChart3, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20',
              trend: revenueStats?.growthPercent ?? 0,
            },
            {
              label: 'Net Revenue', value: revenueStats?.netRevenue ?? 0,
              sub: 'After failed payments',
              icon: Wallet, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20',
              trend: null,
            },
            {
              label: 'Avg Transaction', value: revenueStats?.avgTransactionValue ?? 0,
              sub: 'Per successful payment',
              icon: Receipt, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20',
              trend: null,
            },
          ];

          // Pie chart data from typeBreakdown
          const PIE_COLORS: Record<string, string> = {
            companion_session: '#8b5cf6',
            subscription: '#10b981',
            therapist_consultation: '#3b82f6',
            wallet_deposit: '#f59e0b',
            wallet_withdrawal: '#ef4444',
          };
          const pieData = (revenueStats?.typeBreakdown || []).map((t: any) => ({
            name: t._id?.replace(/_/g, ' ') ?? 'other',
            value: t.total,
            count: t.count,
            fill: PIE_COLORS[t._id] ?? '#6b7280',
          }));

          // CSV export
          const exportCSV = () => {
            const headers = ['Invoice', 'Date', 'User', 'Type', 'Amount', 'Commission', 'Earnings', 'GST', 'Method', 'Status'];
            const rows = allPayments.map(p => [
              p.invoiceNumber || p._id,
              new Date(p.createdAt).toLocaleDateString('en-IN'),
              p.userId?.email || 'Unknown',
              p.type || '',
              p.amount,
              p.platformCommission,
              p.companionEarnings,
              p.gst ?? '',
              p.paymentMethod || '',
              p.status,
            ]);
            const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `mindcare_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
            toast({ title: 'Export Ready', description: `${allPayments.length} records exported as CSV.` });
          };

          return (
            <div className="space-y-6 animate-in fade-in duration-500">

              {/* ─── KPI Cards ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpis.map((k, i) => (
                  <div key={i} className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-gray-100/90 dark:border-zinc-900/50 p-4 hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{k.label}</p>
                      <div className={`p-1.5 rounded-lg ${k.bg}`}>
                        <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-zinc-100">
                      ₹{(k.value).toLocaleString('en-IN')}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-gray-400 font-medium">{k.sub}</p>
                      {k.trend !== null && (
                        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${
                          (k.trend ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {(k.trend ?? 0) >= 0
                            ? <ArrowUpRight className="w-3 h-3" />
                            : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(k.trend ?? 0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ─── Charts Row ───────────────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Bar Chart */}
                <div className="lg:col-span-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-gray-100/90 dark:border-zinc-900/50 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" /> Revenue Trend
                      </h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">Revenue, commission & earnings over time</p>
                    </div>
                    <div className="flex gap-1">
                      {(['daily', 'weekly', 'monthly'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => { setChartPeriod(p); fetchRevenueChart(p); }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${
                            chartPeriod === p
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-900'
                          }`}
                        >{p}</button>
                      ))}
                    </div>
                  </div>
                  {chartLoading ? (
                    <div className="h-52 flex items-center justify-center text-xs text-gray-400">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading chart…
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-xs text-gray-400">No chart data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(val: any, name: string) => [`₹${Number(val).toLocaleString('en-IN')}`, name]}
                          contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
                        <Bar dataKey="commission" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Commission" />
                        <Bar dataKey="earnings" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Earnings" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="flex items-center gap-4 mt-3 justify-center">
                    {[['Revenue', '#10b981'], ['Commission', '#3b82f6'], ['Earnings', '#8b5cf6']].map(([label, color]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                        <span className="text-[10px] text-gray-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pie Chart */}
                <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-gray-100/90 dark:border-zinc-900/50 p-5">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm flex items-center gap-2 mb-4">
                    <PieChartIcon className="w-4 h-4 text-violet-500" /> Revenue by Type
                  </h3>
                  {pieData.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-gray-400">No data</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                            dataKey="value" paddingAngle={3}>
                            {pieData.map((entry: any, i: number) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`]}
                            contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {pieData.map((d: any, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                              <span className="text-[10px] text-gray-600 capitalize">{d.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-700">₹{Number(d.value).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ─── Transactions Ledger ──────────────────────────────────── */}
              <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-gray-100/90 dark:border-zinc-900/50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-zinc-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-500" /> Transactions Ledger
                        <span className="text-[10px] bg-gray-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full text-gray-500 font-semibold">
                          {paymentTotal} total
                        </span>
                      </h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">All platform payment records from MongoDB</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-gray-200 text-xs gap-1.5 h-7"
                        onClick={() => { fetchRevenueStats(); fetchRevenueChart(chartPeriod); fetchAllPayments(1); }}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-7"
                        onClick={exportCSV}
                        disabled={allPayments.length === 0}
                      >
                        <Download className="w-3 h-3" /> Export CSV
                      </Button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input
                        placeholder="Search user, invoice…"
                        value={txSearch}
                        onChange={e => setTxSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchAllPayments(1)}
                        className="pl-7 h-7 text-xs rounded-xl border-gray-200"
                      />
                    </div>
                    <Select value={txType} onValueChange={v => { setTxType(v); setTimeout(() => fetchAllPayments(1), 0); }}>
                      <SelectTrigger className="h-7 w-40 text-xs rounded-xl border-gray-200">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="companion_session">Companion Session</SelectItem>
                        <SelectItem value="subscription">Subscription</SelectItem>
                        <SelectItem value="therapist_consultation">Therapist Consultation</SelectItem>
                        <SelectItem value="wallet_deposit">Wallet Deposit</SelectItem>
                        <SelectItem value="wallet_withdrawal">Wallet Withdrawal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={txStatus} onValueChange={v => { setTxStatus(v); setTimeout(() => fetchAllPayments(1), 0); }}>
                      <SelectTrigger className="h-7 w-32 text-xs rounded-xl border-gray-200">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs rounded-xl border-gray-200 gap-1"
                      onClick={() => fetchAllPayments(1)}
                    >
                      <Filter className="w-3 h-3" /> Apply
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-zinc-900 bg-gray-50/60 dark:bg-zinc-900/30">
                        {['Invoice', 'Date', 'User', 'Type', 'Amount', 'Commission', 'Earnings', 'GST', 'Method', 'Status'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-900/50">
                      {txLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            {Array.from({ length: 10 }).map((_, j) => (
                              <td key={j} className="px-4 py-3">
                                <div className="h-3 bg-gray-100 dark:bg-zinc-900 rounded w-16" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : allPayments.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                            <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                            No transactions found.
                          </td>
                        </tr>
                      ) : (
                        allPayments.map((tx: any) => (
                          <tr key={tx._id} className="hover:bg-gray-50/40 dark:hover:bg-zinc-900/20 transition-colors">
                            <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{tx.invoiceNumber || tx._id?.toString().slice(-8)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-700 dark:text-zinc-300">{tx.userId?.name || '—'}</div>
                              <div className="text-[10px] text-gray-400">{tx.userId?.email || ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={`text-[10px] font-semibold border-0 ${
                                tx.type === 'subscription' ? 'bg-emerald-100 text-emerald-700' :
                                tx.type === 'therapist_consultation' ? 'bg-blue-100 text-blue-700' :
                                tx.type === 'companion_session' ? 'bg-violet-100 text-violet-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {tx.type?.replace(/_/g, ' ') || 'session'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-800 dark:text-zinc-200">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-blue-600 font-semibold">₹{Number(tx.platformCommission).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-violet-600 font-semibold">₹{Number(tx.companionEarnings).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-gray-400">₹{Number(tx.gst ?? 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-gray-500">{tx.paymentMethod || '—'}</td>
                            <td className="px-4 py-3">
                              <Badge className={`text-[10px] font-bold border-0 ${
                                tx.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                              }`}>
                                {tx.status === 'success' ? '✓ Paid' : '✗ Failed'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {paymentPages > 1 && (
                  <div className="p-4 border-t border-gray-100 dark:border-zinc-900 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">
                      Page {paymentPage} of {paymentPages} · {paymentTotal} records
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm" variant="outline"
                        className="h-7 w-7 p-0 rounded-lg border-gray-200"
                        disabled={paymentPage <= 1 || txLoading}
                        onClick={() => { const p = paymentPage - 1; setPaymentPage(p); fetchAllPayments(p); }}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      {Array.from({ length: Math.min(paymentPages, 5) }, (_, i) => {
                        const startPage = Math.max(1, paymentPage - 2);
                        const p = startPage + i;
                        if (p > paymentPages) return null;
                        return (
                          <button
                            key={p}
                            onClick={() => { setPaymentPage(p); fetchAllPayments(p); }}
                            className={`h-7 w-7 rounded-lg text-[10px] font-bold transition-all ${
                              p === paymentPage
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-900'
                            }`}
                          >{p}</button>
                        );
                      })}
                      <Button
                        size="sm" variant="outline"
                        className="h-7 w-7 p-0 rounded-lg border-gray-200"
                        disabled={paymentPage >= paymentPages || txLoading}
                        onClick={() => { const p = paymentPage + 1; setPaymentPage(p); fetchAllPayments(p); }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Appointments & Refunds Management Tab */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            {/* Filter & Action Bar */}
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100 dark:border-zinc-900 p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search user, therapist, Txn ID, Ref ID..."
                  value={apptSearch}
                  onChange={(e) => setApptSearch(e.target.value)}
                  className="pl-9 text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                <Select value={apptStatusFilter} onValueChange={(val) => setApptStatusFilter(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 min-w-[130px]">
                    <SelectValue placeholder="Appt Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Appt Status</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={apptPaymentFilter} onValueChange={(val) => setApptPaymentFilter(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 min-w-[130px]">
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Payment Status</SelectItem>
                    <SelectItem value="SUCCESS">SUCCESS</SelectItem>
                    <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={apptRefundFilter} onValueChange={(val) => setApptRefundFilter(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 dark:border-zinc-800 min-w-[130px]">
                    <SelectValue placeholder="Refund Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Refund Status</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="NOT_REQUIRED">NOT REQUIRED</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={() => fetchAdminAppointments(1)} size="sm" variant="outline" className="rounded-xl border-gray-200 dark:border-zinc-800 h-9">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>

                <Button onClick={handleExportAppointmentsReport} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 h-9">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>
            </div>

            {/* Main Appointments Table */}
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100 dark:border-zinc-900 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-900 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Appointments &amp; Refunds Directory</h3>
                  <p className="text-[11px] text-gray-400">Complete record of bookings, payments, and automated refunds</p>
                </div>
                <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold border-0 text-xs">
                  {apptTotal} total records
                </Badge>
              </div>

              {apptLoading ? (
                <div className="p-8 text-center text-xs text-gray-500 font-medium">Fetching appointment records...</div>
              ) : adminAppointments.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-medium">No appointment records match your filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-zinc-900 text-[10px] font-bold text-gray-400 uppercase bg-gray-50/50 dark:bg-zinc-900/30">
                        <th className="p-3.5">Patient / Therapist</th>
                        <th className="p-3.5">Date &amp; Slot</th>
                        <th className="p-3.5">Fee / Paid</th>
                        <th className="p-3.5">Appt Status</th>
                        <th className="p-3.5">Payment Status</th>
                        <th className="p-3.5">Refund Reference</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                      {adminAppointments.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50/40 dark:hover:bg-zinc-900/20 transition-colors">
                          <td className="p-3.5">
                            <div>
                              <p className="font-bold text-gray-900 dark:text-zinc-100">{item.user?.name || "Patient"}</p>
                              <p className="text-[10px] text-gray-400">{item.user?.email || "N/A"}</p>
                              <p className="text-[10px] text-primary font-semibold mt-0.5">Therapist: {item.therapist?.name || "Therapist"}</p>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-gray-800 dark:text-zinc-200">{new Date(item.date).toLocaleDateString()}</p>
                            <p className="text-[10px] text-gray-400">{item.timeSlot}</p>
                            <span className="text-[9px] font-semibold text-gray-500 uppercase">{item.type || "voice"}</span>
                          </td>
                          <td className="p-3.5 font-bold text-gray-800 dark:text-zinc-200">
                            ₹{item.consultationFee ?? 0}
                            <p className="text-[10px] text-emerald-600 font-medium">Paid: ₹{item.amountPaid ?? 0}</p>
                          </td>
                          <td className="p-3.5">
                            <Badge className={`border-0 text-[10px] font-bold uppercase ${
                              item.status === "APPROVED" || item.status === "approved" || item.status === "confirmed"
                                ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                : item.status === "PENDING_APPROVAL" || item.status === "pending"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : item.status === "COMPLETED" || item.status === "completed"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            }`}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            <Badge className={`border-0 text-[10px] font-bold uppercase ${
                              item.paymentStatus === "REFUNDED" || item.paymentStatus === "refunded"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                                : item.paymentStatus === "SUCCESS" || item.paymentStatus === "success"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}>
                              {item.paymentStatus || "SUCCESS"}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            {item.refundReference ? (
                              <div>
                                <p className="font-mono text-[10px] font-bold text-purple-700 dark:text-purple-300">{item.refundReference}</p>
                                <p className="text-[9px] text-gray-400">Amt: ₹{item.refundAmount || item.consultationFee}</p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedApptModal(item)}
                                className="rounded-xl text-[10px] h-7 px-2 border-gray-200"
                              >
                                View Details
                              </Button>

                              {item.paymentStatus !== "REFUNDED" && item.paymentStatus !== "refunded" && item.status !== "CANCELLED" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAdminProcessRefund(item._id)}
                                  className="rounded-xl text-[10px] h-7 px-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                                >
                                  Process Refund
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {apptPages > 1 && (
                <div className="p-4 border-t border-gray-100 dark:border-zinc-900 flex items-center justify-between">
                  <p className="text-[10px] text-gray-400">
                    Page {apptPage} of {apptPages} · {apptTotal} records
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="outline"
                      className="h-7 w-7 p-0 rounded-lg border-gray-200"
                      disabled={apptPage <= 1 || apptLoading}
                      onClick={() => fetchAdminAppointments(apptPage - 1)}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 w-7 p-0 rounded-lg border-gray-200"
                      disabled={apptPage >= apptPages || apptLoading}
                      onClick={() => fetchAdminAppointments(apptPage + 1)}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Appointment Modal */}
        {selectedApptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 max-w-lg w-full border border-gray-100 dark:border-zinc-900 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-zinc-900 pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Appointment Details</h3>
                  <p className="text-[10px] text-gray-400 font-mono">ID: {selectedApptModal._id}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedApptModal(null)} className="rounded-xl">
                  <X className="w-4 h-4 text-gray-500" />
                </Button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Patient</span>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">{selectedApptModal.user?.name}</span>
                    <p className="text-[10px] text-gray-500">{selectedApptModal.user?.email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Therapist</span>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">{selectedApptModal.therapist?.name}</span>
                    <p className="text-[10px] text-gray-500">{selectedApptModal.therapist?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Session Date &amp; Slot</span>
                    <span className="font-semibold">{new Date(selectedApptModal.date).toLocaleDateString()} at {selectedApptModal.timeSlot}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Fee / Amount Paid</span>
                    <span className="font-semibold text-emerald-600">₹{selectedApptModal.consultationFee} (Paid: ₹{selectedApptModal.amountPaid || selectedApptModal.consultationFee})</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-900">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Appt Status</span>
                    <Badge className="text-[10px] font-bold">{selectedApptModal.status}</Badge>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Payment Status</span>
                    <Badge className="text-[10px] font-bold bg-emerald-600 text-white">{selectedApptModal.paymentStatus}</Badge>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block">Refund Status</span>
                    <Badge className="text-[10px] font-bold bg-purple-600 text-white">{selectedApptModal.refundStatus || "NOT_REQUIRED"}</Badge>
                  </div>
                </div>

                {selectedApptModal.paymentId && (
                  <div className="p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl space-y-1 font-mono text-[10px]">
                    <p><span className="font-bold text-gray-500">Gateway Txn ID:</span> {selectedApptModal.gatewayTransactionId || selectedApptModal.paymentId}</p>
                    <p><span className="font-bold text-gray-500">Razorpay Order ID:</span> {selectedApptModal.orderId || "N/A"}</p>
                  </div>
                )}

                {selectedApptModal.refundReference && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl space-y-1">
                    <p className="font-bold text-purple-900 dark:text-purple-200 text-xs">Automated Refund Trace</p>
                    <p className="font-mono text-[10px]">Refund Reference: {selectedApptModal.refundReference}</p>
                    <p className="font-mono text-[10px]">Refund ID: {selectedApptModal.refundId}</p>
                    <p className="text-[10px]">Refund Amount: ₹{selectedApptModal.refundAmount || selectedApptModal.consultationFee}</p>
                    {selectedApptModal.cancellationReason && (
                      <p className="text-[10px] text-gray-600 dark:text-zinc-300 pt-1 font-sans">Reason: {selectedApptModal.cancellationReason}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-zinc-900">
                {selectedApptModal.paymentStatus !== "REFUNDED" && selectedApptModal.paymentStatus !== "refunded" && (
                  <Button
                    onClick={() => handleAdminProcessRefund(selectedApptModal._id)}
                    className="rounded-xl text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold"
                  >
                    Process Refund
                  </Button>
                )}
                <Button onClick={() => setSelectedApptModal(null)} variant="outline" className="rounded-xl text-xs">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-900 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-xl text-gray-800 dark:text-zinc-100">Platform Settings</h2>
                  <p className="text-sm text-gray-400 mt-1">Manage global configuration for MindCare</p>
                </div>
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/95 text-white rounded-xl shadow-md font-bold px-6 h-10"
                >
                  Save Changes
                </Button>
              </div>
              
              <div className="p-6 grid gap-8">
                {/* Financial Settings */}
                <div>
                  <h3 className="font-bold text-gray-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Financial & Commissions
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Companion Commission Rate (Decimal)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        max="1"
                        value={systemSettings.companionCommissionRate}
                        onChange={(e) => setSystemSettings({...systemSettings, companionCommissionRate: parseFloat(e.target.value)})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                      <p className="text-[10px] text-gray-400">Example: 0.20 for 20%</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Therapist Commission Rate (Decimal)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        max="1"
                        value={systemSettings.therapistCommissionRate}
                        onChange={(e) => setSystemSettings({...systemSettings, therapistCommissionRate: parseFloat(e.target.value)})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                      <p className="text-[10px] text-gray-400">Example: 0.15 for 15%</p>
                    </div>
                  </div>
                </div>

                {/* Platform Rules */}
                <div className="pt-6 border-t border-gray-100 dark:border-zinc-900">
                  <h3 className="font-bold text-gray-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    Platform Rules
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Free Trial Duration (Minutes)</label>
                      <input 
                        type="number" 
                        value={systemSettings.freeTrialMinutes}
                        onChange={(e) => setSystemSettings({...systemSettings, freeTrialMinutes: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Emergency Hotline</label>
                      <input 
                        type="text" 
                        value={systemSettings.emergencyHotline}
                        onChange={(e) => setSystemSettings({...systemSettings, emergencyHotline: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="pt-6 border-t border-gray-100 dark:border-zinc-900">
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={systemSettings.allowAnonymousSessions}
                        onChange={(e) => setSystemSettings({...systemSettings, allowAnonymousSessions: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                      />
                      <div>
                        <div className="font-bold text-sm text-gray-700 dark:text-zinc-200">Allow Anonymous Sessions</div>
                        <div className="text-xs text-gray-400">Users can chat with peers without revealing identity.</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={systemSettings.maintenanceMode}
                        onChange={(e) => setSystemSettings({...systemSettings, maintenanceMode: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-sm text-gray-700 dark:text-zinc-200">Maintenance Mode</div>
                        <div className="text-xs text-gray-400 text-red-500">Warning: Setting this to true will disable access for non-admins.</div>
                      </div>
                    </label>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Details Drawer */}
      {isUserDrawerOpen && selectedUserProfile && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsUserDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100/50 dark:border-zinc-900">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-900">
              <h2 className="font-bold text-gray-800 dark:text-zinc-200">User Profile</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsUserDrawerOpen(false)} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-16 w-16 border-4 border-primary/20 shrink-0">
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{selectedUserProfile.user.name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-zinc-200">{selectedUserProfile.user.name || "Anonymous User"}</h3>
                  <p className="text-sm text-gray-500">{selectedUserProfile.user.email}</p>
                  {selectedUserProfile.user.panNumber && (
                    <p className="text-xs text-gray-500 mt-1">PAN: {selectedUserProfile.user.panNumber}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="border-gray-200 dark:border-zinc-800 text-[10px] font-bold">{selectedUserProfile.user.role}</Badge>
                    <Badge variant="outline" className="border-gray-200 dark:border-zinc-800 text-[10px] font-bold">{selectedUserProfile.user.status}</Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-sm mb-3 text-gray-700 dark:text-zinc-300">Activity Stats</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/20 rounded-2xl">
                      <div className="text-xs text-gray-500 mb-1 font-semibold">XP Points</div>
                      <div className="font-bold text-gray-800 dark:text-zinc-200">{selectedUserProfile.user.xp || 0}</div>
                    </div>
                    <div className="p-3 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/20 rounded-2xl">
                      <div className="text-xs text-gray-500 mb-1 font-semibold">Current Streak</div>
                      <div className="font-bold text-gray-800 dark:text-zinc-200">{selectedUserProfile.user.streak || 0} days</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-bold text-sm mb-3 flex justify-between items-center text-gray-700 dark:text-zinc-300">
                    Recent Moods 
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">{selectedUserProfile.moods?.length || 0}</Badge>
                  </h4>
                  {selectedUserProfile.moods?.length === 0 && <p className="text-xs text-gray-400">No moods logged</p>}
                  {selectedUserProfile.moods?.map((m: any) => (
                    <div key={m._id} className="text-xs p-3 border border-gray-100/90 dark:border-zinc-900/60 mb-2 rounded-xl shadow-sm flex justify-between items-center bg-white/50 dark:bg-zinc-900/10">
                      <span className="font-bold text-gray-700 dark:text-zinc-300">{m.mood}</span>
                      <span className="text-gray-400 font-semibold">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="font-bold text-sm mb-3 flex justify-between items-center text-gray-700 dark:text-zinc-300">
                    Recent Journals
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">{selectedUserProfile.journals?.length || 0}</Badge>
                  </h4>
                  {selectedUserProfile.journals?.length === 0 && <p className="text-xs text-gray-400">No journals written</p>}
                  {selectedUserProfile.journals?.map((j: any) => (
                    <div key={j._id} className="text-xs p-3 border border-gray-100/90 dark:border-zinc-900/60 mb-2 rounded-xl shadow-sm bg-white/50 dark:bg-zinc-900/10">
                      <div className="font-bold text-gray-700 dark:text-zinc-300 mb-1">{j.title || "Untitled"}</div>
                      <div className="text-gray-400 font-semibold">{new Date(j.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-3 flex justify-between items-center text-gray-700 dark:text-zinc-300">
                    Appointment History
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">{selectedUserProfile.appointments?.length || 0}</Badge>
                  </h4>
                  {selectedUserProfile.appointments?.length === 0 && <p className="text-xs text-gray-400">No appointments recorded</p>}
                  {selectedUserProfile.appointments?.map((appointment: any) => (
                    <div key={appointment._id} className="text-xs p-3 border border-gray-100/90 dark:border-zinc-900/60 mb-2 rounded-xl bg-white/50 dark:bg-zinc-900/10 flex justify-between gap-3">
                      <div><p className="font-bold text-gray-700 dark:text-zinc-300">{appointment.therapistId?.name || 'Therapist'}</p><p className="text-gray-400 mt-0.5">{new Date(appointment.date).toLocaleDateString()} · {appointment.timeSlot}</p></div>
                      <Badge variant="outline" className="h-fit text-[9px]">{appointment.status}</Badge>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-3 flex justify-between items-center text-gray-700 dark:text-zinc-300">
                    Recent Account Activity
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">{selectedUserProfile.activity?.length || 0}</Badge>
                  </h4>
                  {selectedUserProfile.activity?.length === 0 && <p className="text-xs text-gray-400">No account activity recorded</p>}
                  {selectedUserProfile.activity?.map((entry: any) => (
                    <div key={entry._id} className="text-xs p-3 border border-gray-100/90 dark:border-zinc-900/60 mb-2 rounded-xl bg-white/50 dark:bg-zinc-900/10 flex justify-between gap-3">
                      <span className="font-bold text-gray-700 dark:text-zinc-300">{entry.action}</span>
                      <span className="text-gray-400">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
