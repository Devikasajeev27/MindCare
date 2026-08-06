import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/AppLayout";
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Coins, Filter, MessageSquare, Search, Star, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/razorpay";
import { useCurrency } from "@/context/CurrencyContext";
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export interface Therapist {
  id: string;
  name: string;
  title: string;
  specializations: string[];
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  consultationFee: number;
  availability: string;
  avatar: string;
}


type BookingStep = "date" | "time" | "type" | "confirm" | "done";

type SessionType = {
  label: string;
  icon: LucideIcon;
  color: string;
};


const specializations = ["All", "Anxiety", "Depression", "CBT", "Trauma", "Couples", "Mindfulness", "Addiction", "Family"];
const timeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const sessionTypes: SessionType[] = [
  { label: "Chat", icon: MessageSquare, color: "bg-green-100 text-green-600" },
  { label: "Voice Call", icon: MessageSquare, color: "bg-purple-100 text-purple-600" },
];

function getDays() {
  const days: Date[] = [];
  const today = new Date();

  for (let index = 0; index < 14; index += 1) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + index);
    days.push(currentDate);
  }

  return days;
}

function BookingModal({ therapist, onClose }: { therapist: Therapist; onClose: () => void }) {
  const { format } = useCurrency();
  const [step, setStep] = useState<BookingStep>("date");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Array<string>>([]);

  useEffect(() => {
    if (!selectedDay || !therapist.id) return;
    (async () => {
      try {
        const list = await api.appointments.getBookedSlots(therapist.id, selectedDay!.toISOString());
        setBookedSlots(list || []);
      } catch (err) {
        console.error("Failed to load booked slots:", err);
      }
    })();
  }, [selectedDay, therapist.id]);

  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();
  const days = useMemo(() => getDays(), []);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const progressSteps: BookingStep[] = ["date", "time", "confirm"];

  const handleConfirm = async () => {
    setIsBooking(true);
    try {
      await api.therapists.bookAppointment({
        therapistId: therapist.id,
        date: selectedDay?.toISOString() || "",
        timeSlot: selectedTime,
        type: selectedType === "Chat" ? "chat" : "voice",
      } as any);
      setStep("done");
      toast({
        title: "Appointment Request Submitted",
        description: "Your appointment request has been sent successfully. Please wait for therapist approval.",
      });
    } catch (err: any) {
      toast({ title: "Booking Failed", description: err.message || "Could not submit appointment request", variant: "destructive" });
    } finally {
      setIsBooking(false);
    }
  };

  const therapistSchedule = useMemo(() => {
    const raw = therapist.availability;
    const defaultAvail: Record<string, { active: boolean; hours: string }> = {
      Monday: { active: true, hours: "9:00 AM - 5:00 PM" },
      Tuesday: { active: true, hours: "9:00 AM - 5:00 PM" },
      Wednesday: { active: true, hours: "9:00 AM - 5:00 PM" },
      Thursday: { active: true, hours: "9:00 AM - 5:00 PM" },
      Friday: { active: true, hours: "9:00 AM - 5:00 PM" },
      Saturday: { active: false, hours: "Closed" },
      Sunday: { active: false, hours: "Closed" }
    };

    if (!raw) return defaultAvail;
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return { ...defaultAvail, ...(raw as Record<string, any>) };

    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
          return { ...defaultAvail, ...parsed };
        }
      } catch (_) {}

      if (raw.includes(":") || raw.includes("|")) {
        const newAvail = { ...defaultAvail };
        Object.keys(newAvail).forEach(day => {
          newAvail[day] = { active: false, hours: "Closed" };
        });

        const parts = raw.split("|");
        parts.forEach((part: string) => {
          const [day, hours] = part.split(":").map(s => s.trim());
          if (day && newAvail[day]) {
            const isOff = hours ? (hours.toLowerCase().includes("off") || hours.toLowerCase().includes("closed")) : false;
            newAvail[day] = {
              active: !isOff,
              hours: hours || "9:00 AM - 5:00 PM"
            };
          }
        });
        return newAvail;
      }
    }

    return defaultAvail;
  }, [therapist.availability]);

  const isDateAvailable = (date: Date): boolean => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const dayData = therapistSchedule[dayName];
    return !!(dayData && dayData.active);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Book session with ${therapist.name}`}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border-2 border-white/30">
              <AvatarImage src={therapist.avatar} alt={therapist.name} />
              <AvatarFallback className="font-bold text-blue-600">{therapist.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-white">{therapist.name}</p>
              <p className="text-xs text-blue-100">{therapist.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 p-1.5 transition-colors hover:bg-white/20"
            aria-label="Close booking modal"
            type="button"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {step !== "done" ? (
          <div className="flex gap-2 px-6 pt-4" aria-hidden="true">
            {progressSteps.map((progressStep, index) => (
              <div
                key={progressStep}
                className={`h-1.5 flex-1 rounded-full transition-colors ${progressSteps.indexOf(step) >= index ? "bg-blue-500" : "bg-gray-200"}`}
              />
            ))}
          </div>
        ) : null}

        <div className="p-6">
          {step === "done" ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Request Submitted! ⏳</h3>
              <p className="mb-4 text-sm text-gray-500">
                Your appointment request has been sent to <strong>{therapist.name}</strong> for approval. You will receive an in-app notification once approved to complete payment.
              </p>
              <div className="mb-6 space-y-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-semibold text-gray-800">{selectedDay ? formatDate(selectedDay) : ""}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-semibold text-gray-800">{selectedTime}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-semibold text-gray-800">{selectedType}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Fee</span><span className="font-semibold text-gray-800">{format(therapist.consultationFee)}</span></div>
              </div>
              <Button onClick={onClose} className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white" type="button">
                Done
              </Button>
            </div>
          ) : null}

          {step === "date" ? (
            <div>
              <h3 className="mb-4 font-bold text-gray-800">Select a Date</h3>
              <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {days.map((day, index) => {
                  const isToday = index === 0;
                  const isAvailable = isDateAvailable(day);
                  const isSelected = selectedDay?.toDateString() === day.toDateString();
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && setSelectedDay(day)}
                      className={`rounded-xl border-2 p-3 text-center transition-all ${
                        !isAvailable 
                          ? "border-gray-100 bg-gray-100/60 opacity-40 cursor-not-allowed" 
                          : isSelected 
                            ? "border-blue-500 bg-blue-50 cursor-pointer" 
                            : "border-gray-100 bg-gray-50 hover:border-blue-300 cursor-pointer"
                      }`}
                      type="button"
                    >
                      <p className={`text-[10px] font-semibold uppercase ${!isAvailable ? "text-gray-400" : isSelected ? "text-blue-600" : "text-gray-400"}`}>
                        {day.toLocaleDateString("en-US", { weekday: "short" })}
                      </p>
                      <p className={`text-lg font-bold ${!isAvailable ? "text-gray-400 line-through" : isSelected ? "text-blue-600" : "text-gray-800"}`}>{day.getDate()}</p>
                      {isAvailable ? (
                        isToday ? <p className="text-[9px] font-bold text-green-600">Today</p> : null
                      ) : (
                        <p className="text-[9px] font-bold text-red-500">Off Shift</p>
                      )}
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => setStep("time")}
                disabled={!selectedDay}
                className="mt-4 h-11 w-full rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-40"
                type="button"
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : null}


  {step === "time" ? (
    <div>
      <h3 className="mb-1 font-bold text-gray-800">Select a Time</h3>
      <p className="mb-4 text-xs text-gray-400">{selectedDay ? formatDate(selectedDay) : ""}</p>
      <div className="grid grid-cols-3 gap-2">
        {timeSlots.map((timeSlot) => {
          const isBooked = bookedSlots.includes(timeSlot);
          const isSelected = selectedTime === timeSlot;
          return (
            <button
              key={timeSlot}
              disabled={isBooked}
              onClick={() => !isBooked && setSelectedTime(timeSlot)}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                isBooked
                  ? "border-gray-100 bg-gray-100/70 text-gray-400 cursor-not-allowed line-through"
                  : isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-100 bg-gray-50 text-gray-700 hover:border-blue-300"
              }`}
              type="button"
            >
              {timeSlot}
              {isBooked && <span className="block text-[9px] text-red-500 font-bold no-underline">Booked</span>}
            </button>
          );
        })}
      </div>
              <div className="mt-4 flex gap-3">
                <Button variant="outline" onClick={() => setStep("date")} className="h-11 rounded-xl border-gray-200 px-4" type="button">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!selectedTime}
                  className="h-11 flex-1 rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-40"
                  type="button"
                >
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div>
              <h3 className="mb-4 font-bold text-gray-800">Confirm Booking</h3>
              <div className="mb-4 space-y-3 rounded-2xl bg-gray-50 p-4 text-sm">
                {[
                  { label: "Therapist", value: therapist.name },
                  { label: "Date", value: selectedDay ? formatDate(selectedDay) : "" },
                  { label: "Time", value: selectedTime },
                  { label: "Type", value: selectedType },
                  { label: "Duration", value: "50 minutes" },
                  { label: "Fee", value: format(therapist.consultationFee) },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-semibold text-gray-800">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="mb-4 text-xs text-gray-400">
                By confirming, you agree to our cancellation policy. Free cancellation up to 24 hours before your session.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("type")} className="h-11 rounded-xl border-gray-200 px-4" type="button">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleConfirm} disabled={isBooking} className="h-11 flex-1 gap-2 rounded-xl bg-blue-600 font-semibold text-white" type="button">
                  <Check className="h-4 w-4" /> {isBooking ? "Confirming..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function formatTherapistAvailabilityCard(raw: any): { label: string; isAvailableToday: boolean } {
  if (!raw) return { label: "Available Today (09:00 AM - 05:00 PM)", isAvailableToday: true };
  
  if (typeof raw === "string" && (raw === "Available Today" || raw.startsWith("Next Available"))) {
    return { label: raw, isAvailableToday: raw.includes("Today") };
  }

  let scheduleObj: Record<string, { active: boolean; hours: string }> | null = null;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    scheduleObj = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        scheduleObj = parsed;
      }
    } catch (_) {}
  }

  if (scheduleObj) {
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const todayData = scheduleObj[todayName];
    const isAvailableToday = !!(todayData && todayData.active);
    
    const activeDays = Object.entries(scheduleObj)
      .filter(([_, data]) => data && data.active)
      .map(([day]) => day.slice(0, 3));
    
    if (isAvailableToday) {
      return { 
        label: `Today: ${todayData.hours || "09:00 AM - 05:00 PM"} (Shift Active)`, 
        isAvailableToday: true 
      };
    } else if (activeDays.length > 0) {
      return { 
        label: `Active Shifts: ${activeDays.join(", ")}`, 
        isAvailableToday: false 
      };
    }
    return { label: "Off Shift / Closed", isAvailableToday: false };
  }

  if (typeof raw === "string" && (raw.includes(":") || raw.includes("|"))) {
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).slice(0, 3);
    const isTodayInStr = raw.toLowerCase().includes("today") || raw.toLowerCase().includes(todayName.toLowerCase());
    return { label: raw.split("|")[0].trim(), isAvailableToday: isTodayInStr };
  }

  return { label: String(raw), isAvailableToday: String(raw).includes("Today") };
}

export default function Therapists() {
  const { format } = useCurrency();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeSpec, setActiveSpec] = useState("All");
  const [booking, setBooking] = useState<Therapist | null>(null);
  const [therapistsList, setTherapistsList] = useState<Therapist[]>([]);

  useEffect(() => {
    async function loadTherapists() {
      try {
        const list = await api.therapists.list();
        if (list && list.length > 0) {
          const mapped = list.map(t => {
            const rawSpecs = t.specializations;
            const normalizedSpecs = Array.isArray(rawSpecs)
              ? rawSpecs
              : (typeof rawSpecs === 'string' ? (rawSpecs as string).split(',').map(s => s.trim()) : []);

            return {
              ...t,
              id: t._id || t.id,
              consultationFee: Number(t.consultationFee) || 0,
              specializations: normalizedSpecs
            };
          });
          setTherapistsList(mapped);
        } else setTherapistsList([]);
      } catch (err) {
        console.error("Failed to load therapists from backend:", err);
        setTherapistsList([]);
      }
    }
    loadTherapists();
  }, []);

  const allTherapists = therapistsList;
  const filteredTherapists = useMemo(() => {
    return allTherapists.filter((therapist) => {
      const specs = Array.isArray(therapist.specializations)
        ? therapist.specializations
        : (typeof therapist.specializations === 'string' ? (therapist.specializations as string).split(',').map(s => s.trim()) : []);

      const matchesSpec = activeSpec === "All" || specs.some((s) => s.toLowerCase().includes(activeSpec.toLowerCase()));
      
      const searchLower = search.toLowerCase().trim();
      const matchesSearch = !searchLower ||
        therapist.name.toLowerCase().includes(searchLower) ||
        therapist.title.toLowerCase().includes(searchLower) ||
        specs.some((s) => s.toLowerCase().includes(searchLower));

      return matchesSpec && matchesSearch;
    });
  }, [activeSpec, allTherapists, search]);

  return (
    <AppLayout>
      <AnimatePresence>
        {booking ? <BookingModal therapist={booking} onClose={() => setBooking(null)} /> : null}
      </AnimatePresence>

      <div className="space-y-6 pb-10">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-gray-900">Find a Therapist</h1>
          <p className="text-sm text-gray-500">
            Connect with licensed, verified mental health professionals who can help you thrive.
          </p>
        </div>

        <div className="relative h-44 overflow-hidden rounded-3xl">
          <img
            src="https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&q=80&w=1200"
            alt="Therapists"
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-800/80 to-blue-600/30" />
          <div className="absolute inset-0 flex items-center px-8 text-white">
            <div>
              <h2 className="mb-1 text-2xl font-bold">Professional Support</h2>
              <p className="max-w-xs text-sm text-white/80">All therapists are verified and licensed. Book a session today.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, title, or specialty..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-xl border-gray-200 bg-white pl-9 text-sm"
              aria-label="Search therapists"
            />
          </div>
          {search && (
            <Button onClick={() => setSearch("")} variant="ghost" className="h-11 rounded-xl text-xs gap-1 text-gray-500">
              <X className="h-4 w-4" /> Clear Search
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Therapist specializations">
          {specializations.map((specialization) => (
            <button
              key={specialization}
              onClick={() => setActiveSpec(specialization)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeSpec === specialization ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600"}`}
              type="button"
            >
              {specialization}
            </button>
          ))}
        </div>

        {filteredTherapists.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">No therapists matched your search</h3>
            <p className="mt-2 text-sm text-gray-500">Try another name, specialty, or clear the search filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTherapists.map((therapist, index) => {
              const availInfo = formatTherapistAvailabilityCard(therapist.availability);
              const specs = Array.isArray(therapist.specializations)
                ? therapist.specializations
                : (typeof therapist.specializations === 'string' ? (therapist.specializations as string).split(',').map(s => s.trim()) : []);

              const avatarSrc = therapist.avatar && therapist.avatar.trim() !== "" && !therapist.avatar.includes("dicebear.com")
                ? therapist.avatar
                : undefined;

              return (
                <motion.div
                  key={therapist.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                  className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-500/30 flex flex-col justify-between"
                >
                  <div>
                    <div className="mb-4 flex items-start gap-4">
                      <Avatar className="h-16 w-16 shrink-0 border-2 border-gray-100 dark:border-zinc-800">
                        <AvatarImage src={avatarSrc} alt={therapist.name} />
                        <AvatarFallback className="bg-blue-100 dark:bg-blue-950 text-lg font-bold text-blue-600 dark:text-blue-300">{therapist.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{therapist.name}</p>
                        <p className="mb-1 text-xs text-gray-400">{therapist.title}</p>
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{therapist.rating || 4.9}</span>
                          <span className="text-xs text-gray-400">({therapist.reviewCount || 42})</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {specs.map((specialization) => (
                        <Badge key={specialization} variant="secondary" className="border-0 bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          {specialization}
                        </Badge>
                      ))}
                    </div>

                    <div className="mb-4 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{therapist.yearsExperience || 8} years clinical experience</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-zinc-100">
                        <Coins className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{format(therapist.consultationFee || 1200)} / session</span>
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        <span className={`h-2.5 w-2.5 rounded-full ${availInfo.isAvailableToday ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                        <span className={availInfo.isAvailableToday ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-gray-600 dark:text-zinc-400"}>
                          {availInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-50 dark:border-zinc-900">
                    <Button onClick={() => setBooking(therapist)} size="sm" className="flex-1 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 gap-1.5 shadow-sm" type="button">
                      <Calendar className="h-3.5 w-3.5" /> Book Session
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-gray-200 dark:border-zinc-800 px-3 text-xs"
                      type="button"
                      aria-label={`Message ${therapist.name}`}
                      onClick={async () => {
                        try {
                          // The server verifies approval, payment, ownership, and
                          // messaging access before exposing an appointment id.
                          const appointment = await api.appointments.getMessageableAppointment(therapist.id);
                          navigate(`/therapist-chat?appointmentId=${appointment._id}`);
                        } catch (err: any) {
                          toast({
                            title: 'Messaging is not available yet',
                            description: err.message || 'Please try again later.',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
