import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, ShieldAlert, Heart, Plus, Trash2, AlertCircle, MessageSquare, Loader2, ShieldCheck, LifeBuoy, Wind } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useLocationReporter } from '@/hooks/useLocationReporter';

const hotlines = [
  { name: "KIRAN Mental Health Helpline", number: "1800-599-0019", hours: "24/7 National", desc: "Govt of India Official Mental Health Line", color: "border-red-200 bg-red-50/60 dark:bg-red-950/30" },
  { name: "Tele-MANAS NIMHANS", number: "14416", hours: "24/7 Free", desc: "Tele Mental Health Assistance", color: "border-blue-200 bg-blue-50/60 dark:bg-blue-950/30" },
  { name: "Vandrevala Foundation", number: "9999-666-555", hours: "24/7", desc: "Crisis Counseling & Support", color: "border-amber-200 bg-amber-50/60 dark:bg-amber-950/30" },
  { name: "iCALL TISS Helpline", number: "91529-87821", hours: "Mon-Sat 8AM-10PM", desc: "Psychosocial Support TISS", color: "border-purple-200 bg-purple-50/60 dark:bg-purple-950/30" },
];

export default function CrisisSupport() {
  useLocationReporter();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '', email: '' });
  const [triggeringManual, setTriggeringManual] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const data = await api.crisis.getContacts();
      setContacts(data);
    } catch (err: any) {
      console.error("Failed to load emergency contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone || !newContact.relation) {
      toast({ variant: "destructive", title: "Missing fields", description: "Name, phone, and relationship are required." });
      return;
    }

    try {
      const saved = await api.crisis.saveContact({
        name: newContact.name,
        relationship: newContact.relation,
        phone: newContact.phone,
        countryCode: "+91",
        email: newContact.email || undefined
      });

      setContacts(prev => [...prev, saved]);
      setNewContact({ name: '', phone: '', relation: '', email: '' });
      setAdding(false);
      toast({ title: "Contact Registered 🌿", description: "Successfully added new emergency contact." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action failed", description: err.message || "Failed to save contact." });
    }
  };

  const handleTriggerManualDistress = async () => {
    setTriggeringManual(true);
    try {
      const { assignment } = await api.crisis.triggerSOS();
      if (assignment.connected) {
        toast({ title: "Emergency therapist connected", description: "A therapist has accepted your emergency support request." });
      } else if (assignment.pending) {
        toast({ title: "Emergency request sent", description: "An on-call therapist has been asked to accept. Call 112 or Tele-MANAS 14416 if you may be in immediate danger." });
      } else {
        toast({ variant: "destructive", title: "No on-call therapist is available", description: "Please call 112 or Tele-MANAS at 14416 now. Your request has been recorded for follow-up." });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "SOS Alert Failed",
        description: fontErrorDesc(err.message)
      });
    } finally {
      setTriggeringManual(false);
    }
  };

  const fontErrorDesc = (msg: string) => msg || "Please dial KIRAN (1800-599-0019) or 112 directly.";

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-red-600" /> Crisis &amp; Emergency Support Hub
            </h1>
            <p className="text-sm text-gray-500">You are not alone. Instant 24/7 crisis intervention and emergency assistance.</p>
          </div>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-0 text-xs px-3.5 py-1.5 font-bold self-start sm:self-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> 24/7 Responders Online
          </Badge>
        </div>

        {/* SOS Alert Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-red-800 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black leading-tight">Request Emergency Assist (SOS)</h2>
              </div>
              <p className="text-xs sm:text-sm text-red-100 leading-relaxed font-medium">
                Your SOS is offered to one verified on-call therapist at a time. A connection starts only after the therapist accepts; call 112 or Tele-MANAS (14416) for immediate danger.
              </p>
            </div>

            <Button
              onClick={handleTriggerManualDistress}
              disabled={triggeringManual}
              className="bg-white text-red-700 hover:bg-red-50 font-black rounded-2xl px-6 h-12 text-sm shrink-0 shadow-lg shadow-red-950/30"
            >
              {triggeringManual ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-red-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 mr-2 text-red-600" />
              )}
              Trigger Emergency SOS
            </Button>
          </div>
        </div>

        {/* 24/7 National Hotlines */}
        <div>
          <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base mb-3">Verified 24/7 Helpline Services</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hotlines.map((h, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-5 transition-all shadow-sm ${h.color} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-black text-gray-900 dark:text-zinc-100 text-sm">{h.name}</p>
                    <Badge className="bg-white/80 dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-0 text-[10px] font-bold">
                      {h.hours}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-3">{h.desc}</p>
                  <p className="text-lg font-black text-gray-900 dark:text-zinc-100">{h.number}</p>
                </div>
                <Button
                  asChild
                  className="mt-4 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 gap-1.5"
                >
                  <a href={`tel:${h.number.replace(/[^0-9]/g, '')}`}>
                    <Phone className="w-3.5 h-3.5" /> Call Helpline Now
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contacts Section */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">My Emergency Contacts</h3>
              <p className="text-xs text-gray-400">People you can contact directly for support</p>
            </div>
            <Button
              size="sm"
              onClick={() => setAdding(true)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-9 font-bold px-4"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-gray-400 font-medium">No emergency contacts added yet. Click "Add Contact" to protect yourself.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map(c => (
                <div key={c._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-emerald-200">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-sm">
                        {c.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                        {c.relationship} · {c.countryCode || '+91'} {c.phone}
                      </p>
                    </div>
                  </div>
                  <a href={`tel:${c.phone}`}>
                    <Button size="sm" className="rounded-xl bg-emerald-600 text-white text-xs font-bold h-9 px-4 gap-1">
                      <Phone className="w-3.5 h-3.5" /> Call
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}

          {adding && (
            <div className="mt-4 p-5 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 space-y-3">
              <h4 className="font-bold text-xs text-gray-800 dark:text-zinc-200">Register Emergency Contact</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Full Name"
                  value={newContact.name}
                  onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                  className="h-10 rounded-xl border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                />
                <Input
                  placeholder="Relationship (e.g. Spouse, Parent)"
                  value={newContact.relation}
                  onChange={e => setNewContact(p => ({ ...p, relation: e.target.value }))}
                  className="h-10 rounded-xl border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                  className="h-10 rounded-xl border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                />
                <Input
                  placeholder="Email Address (Optional)"
                  value={newContact.email}
                  onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                  className="h-10 rounded-xl border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setAdding(false)} className="rounded-xl border-gray-200 text-xs h-9">
                  Cancel
                </Button>
                <Button onClick={addContact} className="rounded-xl bg-emerald-600 text-white text-xs h-9 font-bold px-5">
                  Save Contact
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Immediate Grounding Exercise */}
        <div className="bg-emerald-900/90 text-white rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
          <div className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-emerald-300" />
            <h3 className="font-black text-base">5-4-3-2-1 Grounding Technique for Panic Relief</h3>
          </div>
          <p className="text-xs text-emerald-100 leading-relaxed font-medium">
            If you are experiencing overwhelming stress or panic, focus on your surroundings right now:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
            {[
              { num: "5", label: "Things you see" },
              { num: "4", label: "Things you feel" },
              { num: "3", label: "Things you hear" },
              { num: "2", label: "Things you smell" },
              { num: "1", label: "Thing you taste" },
            ].map((g, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/20">
                <p className="text-xl font-black text-emerald-300">{g.num}</p>
                <p className="text-[10px] text-white font-bold">{g.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
