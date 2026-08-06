import React from 'react';
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  MessageSquare, 
  PieChart, 
  Clock, 
  IndianRupee, 
  BookOpen, 
  Settings,
  X,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MindCareLogo } from '@/components/MindCareLogo';

interface TherapistSidebarProps {
  onClose?: () => void;
}

export function TherapistSidebar({ onClose }: TherapistSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const currentUser = user;

  const handleLogout = () => {
    logout();
    setLocation("/", { replace: true });
  };

  const isDicebear = currentUser?.avatar?.includes("dicebear.com");
  const avatarSrc = currentUser?.avatar && !isDicebear ? currentUser.avatar : undefined;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/therapist/dashboard" },
    { icon: Calendar, label: "Appointments", href: "/therapist/appointments" },
    { icon: Users, label: "My Patients", href: "/therapist/patients" },
    { icon: MessageSquare, label: "Messages", href: "/therapist/messages" },
    { icon: PieChart, label: "Analytics", href: "/therapist/analytics" },
    { icon: Clock, label: "Availability", href: "/therapist/availability" },
    { icon: IndianRupee, label: "Earnings", href: "/therapist/earnings" },
    { icon: BookOpen, label: "Resources", href: "/therapist/resources" },
    { icon: Settings, label: "Settings", href: "/therapist/settings" }
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
                  ? 'bg-blue-600/10 text-blue-700 border-blue-200/50 font-semibold shadow-[0_2px_10px_rgba(37,99,235,0.03)]' 
                  : 'border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-blue-600' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'} />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Therapist Profile + Logout */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 flex items-center justify-between gap-1.5 mt-auto">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent cursor-pointer transition-colors min-w-0 flex-1">
          <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
            <AvatarImage src={avatarSrc}/>
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{currentUser?.name?.charAt(0) || 'T'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{currentUser?.name || 'Therapist'}</p>
            <p className="text-xs text-primary font-medium truncate">Therapist</p>
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
