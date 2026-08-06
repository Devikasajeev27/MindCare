import React from 'react';
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Settings,
  X,
  LogOut,
  Users,
  Stethoscope,
  HeartHandshake,
  ShieldAlert,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MindCareLogo } from '@/components/MindCareLogo';

interface AdminSidebarProps {
  onClose?: () => void;
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const currentUser = user || {
    name: "MindCare Admin",
    avatar: ""
  };

  const handleLogout = () => {
    logout();
    setLocation("/", { replace: true });
  };

  const isDicebear = currentUser.avatar?.includes("dicebear.com");
  const avatarSrc = currentUser.avatar && !isDicebear ? currentUser.avatar : undefined;

  const navItems = [
    { icon: LayoutDashboard, label: "Admin Dashboard", href: "/admin/dashboard" },
    { icon: Users, label: "User Management", href: "/admin/users" },
    { icon: Stethoscope, label: "Therapists Review", href: "/admin/therapists" },
    { icon: HeartHandshake, label: "Companion Badges", href: "/admin/companions" },
    { icon: ShieldAlert, label: "Emergency Alerts", href: "/admin/alerts" },
    { icon: Database, label: "System Audit Logs", href: "/admin/audit-logs" },
    { icon: FileSpreadsheet, label: "Payments & Revenue", href: "/admin/revenue" },
    { icon: Settings, label: "Platform Settings", href: "/admin/settings" }
  ];

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col shadow-sm">
      <div className="px-5 py-5 flex items-center justify-between border-b border-sidebar-border">
        <Link href="/">
          <MindCareLogo size="sm" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-sidebar-accent">
            <X className="w-4 h-4 text-sidebar-foreground"/>
          </button>
        )}
      </div>

      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border group ${
                isActive 
                  ? 'bg-red-600/10 text-red-700 border-red-200/50 font-semibold shadow-[0_2px_10px_rgba(220,38,38,0.03)]' 
                  : 'border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-red-600' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'} />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Admin Profile + Logout */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 flex items-center justify-between gap-1.5 mt-auto">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent cursor-pointer transition-colors min-w-0 flex-1">
          <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
            <AvatarImage src={avatarSrc}/>
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{currentUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{currentUser.name}</p>
            <p className="text-xs text-red-500 font-medium truncate">Admin</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 text-muted-foreground transition-colors shrink-0"
          title="Log Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
