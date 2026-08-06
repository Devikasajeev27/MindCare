import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Bell, Shield, CreditCard, Camera, Lock, Mail, Phone, Trash2, Download, Sliders, CheckCircle2, ShieldCheck, Sparkles, Key, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useCountry } from "@/context/CountryContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { PhoneInput, getPhoneDetails, isValidPhoneNumber } from "@/components/ui/PhoneInput";
import { useCommunication } from "@/services/communication/CommunicationProvider";

const tabs = [
  { id: "profile", label: "Profile & Identity", icon: User },
  { id: "notifications", label: "Notification Controls", icon: Bell },
  { id: "privacy", label: "Confidentiality & Privacy", icon: Shield },
  { id: "audio", label: "Voice & ANC Audio", icon: Sliders },
  { id: "billing", label: "Subscriptions & Billing", icon: CreditCard },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [notifs, setNotifs] = useState({ email: true, push: true, sms: false, weekly: true, crisis: true });
  const [privacy, setPrivacy] = useState({ anonymousMode: true, twoFactorAuth: true, dataSharing: false });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [billing, setBilling] = useState<any>(null);
  const { audioSettings } = useCommunication();
  const [micPermission, setMicPermission] = useState(false);
  const [speakerDevice, setSpeakerDevice] = useState("default");

  const { user, updateProfile, deleteAccount, exportAccountData } = useAuth();
  const { currentCountry, setCountryByCode, countries } = useCountry();
  const { format } = useCurrency();
  const { toast } = useToast();

  const currentUser = user || {
    name: "Member User",
    email: "user@mindcare.com",
    role: "User",
    phone: "+91 98765 43210",
    avatar: "",
    emergencyContact: {
      name: "Emergency Contact",
      phone: "+91 98765 43211",
      relation: "parent"
    }
  };

  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [selectedCountryCode, setSelectedCountryCode] = useState(currentCountry.code);
  const [emergencyName, setEmergencyName] = useState(currentUser.emergencyContact?.name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(currentUser.emergencyContact?.phone || "");
  const [emergencyRelation, setEmergencyRelation] = useState(currentUser.emergencyContact?.relation || "parent");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || "");
      setSelectedCountryCode(user.countryCode || currentCountry.code);
      setEmergencyName(user.emergencyContact?.name || "");
      setEmergencyPhone(user.emergencyContact?.phone || "");
      setEmergencyRelation(user.emergencyContact?.relation || "parent");
    }
  }, [user, currentCountry]);

  useEffect(() => {
    api.settings.get().then(res => {
      if (res.notificationPreferences) setNotifs(res.notificationPreferences);
      if (res.privacySettings) setPrivacy(res.privacySettings);
    }).catch(() => {}).finally(() => setSettingsLoading(false));

    api.billing.getOverview().then((res: any) => {
      setBilling(res?.billing || res?.data?.billing || null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then((devices) => {
        const hasMic = devices.some(d => d.kind === "audioinput");
        setMicPermission(hasMic);
      })
      .catch(() => {});
  }, []);

  const handleToggleMicPermission = async (checked: boolean) => {
    if (checked) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setMicPermission(true);
        toast({ title: "Microphone Access Granted 🎙️", description: "MindCare can now record audio for voice consultations." });
      } catch (err) {
        setMicPermission(false);
        toast({ variant: "destructive", title: "Permission Denied", description: "Microphone access is required for voice calls." });
      }
    } else {
      setMicPermission(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await api.settings.update({ notificationPreferences: notifs });
      toast({ title: "Notifications Saved 🌿", description: "Your notification preferences have been updated." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSavePrivacy = async () => {
    try {
      await api.settings.update({ privacySettings: privacy });
      toast({ title: "Privacy Saved 🛡️", description: "Your confidentiality settings have been updated." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSaveProfile = async () => {
    setIsSubmitting(true);
    try {
      const phoneDetails = getPhoneDetails(phone);
      const countryDetails = countries.find(c => c.code === selectedCountryCode) || currentCountry;

      let emergencyContactPayload = null;
      if (emergencyName || emergencyPhone || emergencyRelation) {
        if (emergencyPhone && !isValidPhoneNumber(emergencyPhone)) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please enter a valid emergency contact phone number."
          });
          setIsSubmitting(false);
          return;
        }

        const emergencyPhoneDetails = getPhoneDetails(emergencyPhone);
        emergencyContactPayload = {
          name: emergencyName,
          phone: emergencyPhoneDetails?.internationalFormat || emergencyPhone,
          relation: emergencyRelation
        };
      }

      const payload = {
        name,
        phone: phoneDetails?.internationalFormat || phone,
        country: countryDetails.name,
        countryCode: countryDetails.code,
        dialCode: countryDetails.dialCode,
        phoneNumber: phoneDetails?.internationalFormat || phone,
        currency: countryDetails.currency,
        currencyCode: countryDetails.currencyCode,
        preferredLocale: countryDetails.locale,
        emergencyContact: emergencyContactPayload
      };

      await updateProfile(payload);
      await setCountryByCode(selectedCountryCode);

      toast({
        title: "Profile Updated 🌿",
        description: "Your settings have been saved successfully."
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error saving settings",
        description: err.message || "Failed to update profile settings."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to permanently delete your account? All journals, logs, chats, and appointments will be permanently removed.")) {
      try {
        await deleteAccount();
        toast({ title: "Account Deleted", description: "Your account and data have been removed." });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Deletion Failed", description: err.message });
      }
    }
  };

  const handleExportData = async () => {
    try {
      const blob = await exportAccountData();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `mindcare_profile_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast({ title: "Export Complete 📦", description: "Your personal data package has been downloaded." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-600" /> Account Settings &amp; Personalization
          </h1>
          <p className="text-sm text-gray-500">Manage your identity, confidential privacy preferences, audio devices, and billing.</p>
        </div>

        {/* Meaningful Tabs Navigation */}
        <div className="flex gap-2 flex-wrap bg-gray-50 dark:bg-zinc-900 p-1.5 rounded-2xl border border-gray-100 dark:border-zinc-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === t.id
                  ? "bg-white dark:bg-zinc-950 text-emerald-600 shadow-sm"
                  : "text-gray-600 dark:text-zinc-400 hover:text-gray-900"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile & Identity */}
        {activeTab === "profile" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-6"
          >
            <div className="flex items-center gap-5 pb-6 border-b border-gray-100 dark:border-zinc-900">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-emerald-500/30">
                  <AvatarImage src={currentUser.avatar && !currentUser.avatar.includes("dicebear.com") ? currentUser.avatar : undefined} />
                  <AvatarFallback className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-2xl font-bold">
                    {currentUser.name[0]}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <p className="font-black text-gray-900 dark:text-zinc-100 text-xl">{currentUser.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 border-0 text-xs font-bold capitalize">
                    {currentUser.role} Account
                  </Badge>
                  <span className="text-xs text-gray-400 font-medium">{currentUser.email}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-gray-200 dark:border-zinc-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1 block">Email Address (Primary)</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={currentUser.email}
                    disabled
                    className="pl-10 h-11 rounded-xl border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900 text-gray-500 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1 block">Phone Number</label>
                <PhoneInput
                  value={phone}
                  onChange={(val) => setPhone(val)}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1 block">Country &amp; Locale</label>
                <Select value={selectedCountryCode} onValueChange={(val) => setSelectedCountryCode(val)}>
                  <SelectTrigger className="h-11 rounded-xl border-gray-200 dark:border-zinc-800 text-xs font-bold">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name} ({c.dialCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="pt-6 border-t border-gray-100 dark:border-zinc-900 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Emergency Contact Details</h3>
                <p className="text-xs text-gray-400">Used strictly during automated crisis SOS dispatches</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1 block">Contact Name</label>
                  <Input
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Full name"
                    className="h-11 rounded-xl border-gray-200 dark:border-zinc-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1 block">Relationship</label>
                  <Select value={emergencyRelation} onValueChange={(val) => setEmergencyRelation(val)}>
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 dark:border-zinc-800 text-xs font-bold">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1 block">Phone Number</label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="Emergency phone"
                    className="h-11 rounded-xl border-gray-200 dark:border-zinc-800 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSaveProfile} disabled={isSubmitting} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 shadow-md shadow-emerald-600/20">
                {isSubmitting ? "Saving..." : "Save Profile Settings"}
              </Button>
            </div>

            {/* Data Export & Danger Zone */}
            <div className="pt-6 border-t border-red-100 dark:border-red-950/40 space-y-3">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Account Data &amp; Danger Zone</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportData} variant="outline" className="border-emerald-200 dark:border-emerald-900/40 text-emerald-600 hover:bg-emerald-50 rounded-xl text-xs font-bold h-10 gap-2">
                  <Download className="w-4 h-4" /> Export Personal Data Package (JSON)
                </Button>
                <Button onClick={handleDeleteAccount} variant="outline" className="border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold h-10 gap-2">
                  <Trash2 className="w-4 h-4" /> Permanently Delete Account
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Notification Controls */}
        {activeTab === "notifications" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-4"
          >
            <div className="mb-2">
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">Granular Notification Preferences</h3>
              <p className="text-xs text-gray-400">Control how and when MindCare communicates with you</p>
            </div>

            {[
              { key: "email", label: "Email Notifications & Insights", desc: "Receive weekly wellness digests and appointment confirmations via email" },
              { key: "push", label: "Browser Push Alerts", desc: "Get real-time alerts for incoming peer messages and consultation reminders" },
              { key: "sms", label: "SMS Text Messages", desc: "Receive SMS alerts for critical consultation schedules and verification codes" },
              { key: "weekly", label: "Weekly Progress Report", desc: "Get a comprehensive 7-day emotional trend analysis delivered every Monday" },
              { key: "crisis", label: "Immediate Crisis Detection Alerts", desc: "Enable automated crisis SOS dispatches to emergency contacts" },
            ].map((n) => (
              <div key={n.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <div>
                  <p className="font-bold text-gray-800 dark:text-zinc-200 text-xs">{n.label}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{n.desc}</p>
                </div>
                <Switch
                  checked={notifs[n.key as keyof typeof notifs]}
                  onCheckedChange={(v) => setNotifs((prev) => ({ ...prev, [n.key]: v }))}
                />
              </div>
            ))}

            <Button onClick={handleSaveNotifications} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 mt-4 shadow-md shadow-emerald-600/20">
              Save Notification Preferences
            </Button>
          </motion.div>
        )}

        {/* Tab 3: Confidentiality & Privacy */}
        {activeTab === "privacy" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-4"
          >
            <div className="mb-2">
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">Confidentiality &amp; Platform Privacy</h3>
              <p className="text-xs text-gray-400">Control your visibility, two-factor auth, and data protection settings</p>
            </div>

            {[
              { key: "anonymousMode", label: "Anonymous Companion Mode", desc: "Automatically hide your real name, email, and phone number when talking to peer listeners." },
              { key: "twoFactorAuth", label: "Two-Factor Authentication (2FA)", desc: "Require an OTP code whenever signing into your MindCare account from new devices." },
              { key: "dataSharing", label: "Anonymized Mental Health Research Consent", desc: "Allow de-identified aggregate data to contribute to NIMHANS CBT research." },
            ].map((p) => (
              <div key={p.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <div>
                  <p className="font-bold text-gray-800 dark:text-zinc-200 text-xs">{p.label}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{p.desc}</p>
                </div>
                <Switch
                  checked={privacy[p.key as keyof typeof privacy]}
                  onCheckedChange={(v) => setPrivacy((prev) => ({ ...prev, [p.key]: v }))}
                />
              </div>
            ))}

            <Button onClick={handleSavePrivacy} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 mt-4 shadow-md shadow-emerald-600/20">
              Save Privacy Preferences
            </Button>
          </motion.div>
        )}

        {/* Tab 4: Voice & ANC Audio */}
        {activeTab === "audio" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-4"
          >
            <div>
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">Voice Consultation &amp; ANC Audio Settings</h3>
              <p className="text-xs text-gray-400">Configure microphone permissions, active noise cancellation, and sound quality</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div>
                <p className="font-bold text-gray-800 dark:text-zinc-200 text-xs">Microphone Access Permission</p>
                <p className="text-[11px] text-gray-400 font-medium">Required for voice calls with therapists and AI voice mode</p>
              </div>
              <Switch checked={micPermission} onCheckedChange={handleToggleMicPermission} />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div>
                <p className="font-bold text-gray-800 dark:text-zinc-200 text-xs">Audio Streaming Quality</p>
                <p className="text-[11px] text-gray-400 font-medium">Adjust bitrate for low bandwidth or high fidelity voice</p>
              </div>
              <Select value={audioSettings.audioQuality} onValueChange={(val: any) => audioSettings.setAudioQuality(val)}>
                <SelectTrigger className="w-36 h-9 rounded-xl border-gray-200 text-xs font-bold">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">HD (High)</SelectItem>
                  <SelectItem value="medium">Standard</SelectItem>
                  <SelectItem value="low">Data Saver</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div>
                <p className="font-bold text-gray-800 dark:text-zinc-200 text-xs">Active Noise Cancellation (ANC)</p>
                <p className="text-[11px] text-gray-400 font-medium">Filters background room noise during consultation calls</p>
              </div>
              <Switch checked={audioSettings.noiseCancellation} onCheckedChange={(v) => audioSettings.setNoiseCancellation(v)} />
            </div>
          </motion.div>
        )}

        {/* Tab 5: Subscriptions & Billing */}
        {activeTab === "billing" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">Subscription Plan &amp; Billing</h3>
              <p className="text-xs text-gray-400">Manage membership subscriptions, active invoices, and payment methods</p>
            </div>

            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 p-6 rounded-2xl text-white shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold tracking-wider uppercase mb-1">
                    Active Membership
                  </Badge>
                  <h4 className="text-xl font-black">{billing?.currentPlan?.name || user?.subscription?.planName || 'Free'}</h4>
                  <p className="text-xs text-emerald-200 font-medium">{format(billing?.currentPlan?.price ?? 0)} / month</p>
                </div>
                <Badge className="bg-emerald-500 text-white font-bold border-0 px-3 py-1 text-xs">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                Includes unlimited AI Clinical Companion chat, 2 monthly 45-min licensed therapist consultations, and 24/7 priority emergency SOS routing.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
