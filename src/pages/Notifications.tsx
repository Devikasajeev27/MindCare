import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, Calendar, Heart, TrendingUp, ShieldAlert, CheckCircle2, Trash2, Sparkles, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/context/NotificationsContext';

const typeMap: Record<string, { icon: any; color: string; label: string }> = {
  session: { icon: Calendar, color: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300", label: "Session" },
  message: { icon: MessageSquare, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300", label: "Message" },
  mood: { icon: TrendingUp, color: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300", label: "Mood Log" },
  ai: { icon: Bell, color: "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300", label: "AI Notice" },
  crisis: { icon: ShieldAlert, color: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300", label: "SOS Alert" },
  achievement: { icon: Heart, color: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300", label: "Achievement" },
  alert: { icon: ShieldAlert, color: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300", label: "Alert" },
  default: { icon: Bell, color: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300", label: "System" },
};

export default function Notifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'session' | 'message' | 'alert'>('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { markAllRead: markAllReadContext, refresh } = useNotifications();

  const loadNotifications = () => {
    api.notifications.list()
      .then(res => {
        setNotifs(res || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifs.filter(n => !n.read).length;

  const filteredNotifs = notifs.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'session') return n.type === 'session';
    if (filter === 'message') return n.type === 'message';
    if (filter === 'alert') return n.type === 'crisis' || n.type === 'alert';
    return true;
  });

  const markAll = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      markAllReadContext();
      toast({ title: "Updated", description: "All notifications marked as read." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const remove = async (id: string) => {
    try {
      await api.notifications.delete(id);
      setNotifs(prev => prev.filter(n => n._id !== id));
      refresh();
      toast({ title: "Deleted", description: "Notification removed." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <Bell className="w-6 h-6 text-emerald-600" /> Notifications &amp; Activity
            </h1>
            <p className="text-sm text-gray-500">Stay updated on consultation appointments, AI insights, and milestones.</p>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" onClick={markAll} variant="outline" className="rounded-xl border-gray-200 text-xs font-bold gap-1.5 h-9 self-start sm:self-auto">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mark All Read ({unreadCount})
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All Notifications' },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'session', label: 'Sessions' },
            { id: 'message', label: 'Messages' },
            { id: 'alert', label: 'Alerts' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                filter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-600 hover:border-emerald-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifs.map((n, i) => {
            const mapInfo = typeMap[n.type] || typeMap.default;
            const IconComponent = mapInfo.icon;
            const timeAgo = n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Just now";

            return (
              <motion.div
                key={n._id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-white dark:bg-zinc-950 rounded-2xl border p-5 shadow-sm flex items-start gap-4 transition-all ${
                  !n.read ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-gray-100 dark:border-zinc-800'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold ${mapInfo.color}`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-black ${!n.read ? 'text-gray-900 dark:text-zinc-100' : 'text-gray-700 dark:text-zinc-300'}`}>
                      {n.title}
                    </p>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed font-medium">{n.message || n.desc}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge className="bg-gray-100 dark:bg-zinc-900 text-gray-500 border-0 text-[9px] font-bold">
                      {mapInfo.label}
                    </Badge>
                    <span className="text-[10px] text-gray-400 font-medium">{timeAgo}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {!n.read && (
                    <button onClick={() => handleMarkRead(n._id)} className="p-2 rounded-xl bg-gray-50 dark:bg-zinc-900 hover:bg-emerald-100 text-emerald-600 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => remove(n._id)} className="p-2 rounded-xl bg-gray-50 dark:bg-zinc-900 hover:bg-red-100 text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {!loading && filteredNotifs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center">
            <Bell className="w-10 h-10 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800 dark:text-zinc-200">No Notifications</h3>
            <p className="text-xs text-gray-400 mt-1">You are all caught up! Check back later for updates.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
