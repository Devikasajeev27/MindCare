import React from 'react';
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, MessageSquare, Users, UserPlus, Activity,
  TrendingUp, ShieldAlert, BookOpen, Settings, Bell,
  CreditCard, X, BookMarked, Moon, Sun, Phone, LogOut, HeartHandshake, Calendar
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { motion } from 'framer-motion';
import { MindCareLogo } from '@/components/MindCareLogo';

interface AppSidebarProps { onClose?: () => void; }

export function AppSidebar({ onClose }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unread } = useNotifications();

  const currentUser = user || { name: "Guest User", email: "guest@mindcare.com", avatar: "", role: "user" };

  const handleLogout = () => {
    logout();
    setLocation("/", { replace: true });
  };

  const isDicebear = currentUser.avatar?.includes("dicebear.com");
  const avatarSrc = currentUser.avatar && !isDicebear ? currentUser.avatar : undefined;

  const navItems = [
    { icon: LayoutDashboard,  label: "Dashboard",             href: "/dashboard" },
    { icon: MessageSquare,    label: "AI Assistant",          href: "/ai-assistant" },
    { icon: BookMarked,       label: "Journal",               href: "/journal" },
    { icon: HeartHandshake,   label: "Need Someone to Talk",  href: "/companions" },
    { icon: Users,            label: "Help Someone",          href: "/companions/help" },
    { icon: UserPlus,         label: "Therapists",            href: "/therapists" },
    { icon: Calendar,         label: "Appointments",          href: "/appointments" },
    { icon: Activity,         label: "Mood Tracker",          href: "/mood-tracker" },
    { icon: TrendingUp,       label: "Progress",              href: "/progress" },
    { icon: ShieldAlert,      label: "Crisis Support",        href: "/crisis-support" },
    { icon: BookOpen,         label: "Resources",             href: "/resources" },
    { icon: CreditCard,       label: "Payments",              href: "/payments" },
    { icon: Bell,             label: "Notifications",         href: "/notifications" },
    { icon: Settings,         label: "Settings",              href: "/settings" },
  ];

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col shadow-sm">
      {/* Logo + Dark mode toggle */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-sidebar-border">
        <Link href="/">
          <MindCareLogo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 text-yellow-400"/>
              : <Moon className="w-4 h-4 text-gray-400"/>
            }
          </button>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-sidebar-accent">
              <X className="w-4 h-4 text-sidebar-foreground"/>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <motion.div
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.06 } } }}
      >
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href) && item.href !== '/companions');
          return (
            <motion.div
              key={item.href}
              variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } }}
            >
              <Link href={item.href} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border group ${
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/20 font-semibold shadow-[0_2px_10px_rgba(25,135,84,0.03)]'
                    : 'border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}>
                <item.icon size={18} className={isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'}/>
                <span className="font-medium text-sm">{item.label}</span>
                {item.label === "Notifications" && unread > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">{unread > 99 ? '99+' : unread}</span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Crisis Help */}
      <div className="px-3 py-3">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-red-600 font-semibold text-sm mb-1">
            <ShieldAlert size={15}/><span>Need Immediate Help?</span>
          </div>
          <p className="text-xs text-red-400 mb-2.5">Our team is available 24/7</p>
          <Link href="/crisis-support" onClick={onClose}>
            <button className="w-full flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-xl transition-colors">
              <Phone size={12}/> Crisis Support
            </button>
          </Link>
        </div>
      </div>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent cursor-pointer transition-colors min-w-0 flex-1">
          <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
            <AvatarImage src={avatarSrc}/>
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{currentUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{currentUser.name}</p>
            <p className="text-xs text-primary font-medium truncate">{currentUser.role}</p>
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
