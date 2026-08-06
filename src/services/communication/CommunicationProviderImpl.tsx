import React, { createContext, useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, RefreshCw, Radio, Sliders } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export interface ICommunicationProvider {
  startCall(targetId: string, options?: any): Promise<void>;
  endCall(): Promise<void>;
  mute(): void;
  unmute(): void;
  setSpeaker(enabled: boolean): void;
  getCallStatus(): "idle" | "connecting" | "active" | "muted" | "reconnecting";
  isSupported(): boolean;
}

export class VoiceProvider implements ICommunicationProvider {
  private status: "idle" | "connecting" | "active" | "muted" | "reconnecting" = "idle";
  private onStatusChange: (status: any) => void;

  constructor(onStatusChange: (status: any) => void) {
    this.onStatusChange = onStatusChange;
  }

  async startCall(targetId: string, options?: any): Promise<void> {
    this.status = "connecting";
    this.onStatusChange(this.status);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.status = "active";
        this.onStatusChange(this.status);
        resolve();
      }, 1500);
    });
  }

  async endCall(): Promise<void> {
    this.status = "idle";
    this.onStatusChange(this.status);
  }

  mute(): void {
    this.status = "muted";
    this.onStatusChange(this.status);
  }

  unmute(): void {
    this.status = "active";
    this.onStatusChange(this.status);
  }

  setSpeaker(enabled: boolean): void {
    // Simulated output device toggling
  }

  getCallStatus() {
    return this.status;
  }

  isSupported(): boolean {
    return true;
  }
}

export class VideoProvider implements ICommunicationProvider {
  private onStatusChange: (status: any) => void;

  constructor(onStatusChange: (status: any) => void) {
    this.onStatusChange = onStatusChange;
  }

  async startCall(targetId: string, options?: any): Promise<void> {
    throw new Error("Video Consultation is not supported in the current version.");
  }

  async endCall(): Promise<void> {
    throw new Error("Video Consultation is not supported.");
  }

  mute(): void {
    throw new Error("Video Consultation is not supported.");
  }

  unmute(): void {
    throw new Error("Video Consultation is not supported.");
  }

  setSpeaker(enabled: boolean): void {
    throw new Error("Video Consultation is not supported.");
  }

  getCallStatus() {
    return "idle" as const;
  }

  isSupported(): boolean {
    return false; // Reserved for Future Video Consultation
  }
}

interface CommunicationContextType {
  providerType: "voice" | "video";
  status: "idle" | "connecting" | "active" | "muted" | "reconnecting";
  isCallActive: boolean;
  callDuration: number;
  callMeta: {
    name: string;
    avatar: string;
    role: string;
  };
  startCall: (targetId: string, options?: { name: string; avatar: string; role: string }) => Promise<void>;
  endCall: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  setSpeaker: (enabled: boolean) => void;
  reconnectCall: () => void;
  setProviderType: (type: "voice" | "video") => void;
  audioSettings: {
    noiseCancellation: boolean;
    audioQuality: "high" | "medium" | "low";
    voiceActivityDetection: boolean;
    setNoiseCancellation: (val: boolean) => void;
    setAudioQuality: (val: "high" | "medium" | "low") => void;
    setVoiceActivityDetection: (val: boolean) => void;
  };
}

const CommunicationContext = createContext<CommunicationContextType | undefined>(undefined);

export const CommunicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providerType, setProviderTypeState] = useState<"voice" | "video">("voice");
  const [status, setStatus] = useState<"idle" | "connecting" | "active" | "muted" | "reconnecting">("idle");
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [callMeta, setCallMeta] = useState({ name: "Therapist", avatar: "", role: "Practitioner" });
  
  // Audio Settings state for Voice configuration settings page integration
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [audioQuality, setAudioQuality] = useState<"high" | "medium" | "low">("high");
  const [voiceActivityDetection, setVoiceActivityDetection] = useState(true);

  const [provider, setProvider] = useState<ICommunicationProvider | null>(null);

  useEffect(() => {
    const handleStatusChange = (newStatus: typeof status) => {
      setStatus(newStatus);
      if (newStatus === "idle") {
        setIsCallActive(false);
      }
    };

    if (providerType === "voice") {
      setProvider(new VoiceProvider(handleStatusChange));
    } else {
      setProvider(new VideoProvider(handleStatusChange));
    }
  }, [providerType]);

  // Duration timer
  useEffect(() => {
    let interval: any;
    if (isCallActive && (status === "active" || status === "muted")) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isCallActive, status]);

  const startCall = async (targetId: string, options?: { name: string; avatar: string; role: string }) => {
    if (!provider) return;
    
    // Set metadata before initiating call
    if (options) {
      setCallMeta(options);
    }
    
    setIsCallActive(true);
    setIsMuted(false);
    setSpeakerEnabled(false);
    
    try {
      await provider.startCall(targetId, options);
    } catch (error: any) {
      setIsCallActive(false);
      throw error;
    }
  };

  const endCall = async () => {
    if (provider) {
      await provider.endCall();
    }
    setIsCallActive(false);
  };

  const mute = () => {
    if (provider) {
      provider.mute();
      setIsMuted(true);
    }
  };

  const unmute = () => {
    if (provider) {
      provider.unmute();
      setIsMuted(false);
    }
  };

  const setSpeaker = (enabled: boolean) => {
    if (provider) {
      provider.setSpeaker(enabled);
      setSpeakerEnabled(enabled);
    }
  };

  const reconnectCall = () => {
    setStatus("reconnecting");
    setTimeout(() => {
      setStatus(isMuted ? "muted" : "active");
    }, 1200);
  };

  const setProviderType = (type: "voice" | "video") => {
    setProviderTypeState(type);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <CommunicationContext.Provider
      value={{
        providerType,
        status,
        isCallActive,
        callDuration,
        callMeta,
        startCall,
        endCall,
        mute,
        unmute,
        setSpeaker,
        reconnectCall,
        setProviderType,
        audioSettings: {
          noiseCancellation,
          audioQuality,
          voiceActivityDetection,
          setNoiseCancellation,
          setAudioQuality,
          setVoiceActivityDetection
        }
      }}
    >
      {children}

      {/* Beautiful Glassmorphic Voice Call Overlay */}
      <AnimatePresence>
        {isCallActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 50 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed bottom-6 right-6 z-[9999] w-80 bg-zinc-950/90 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 text-white rounded-3xl p-5 shadow-2xl shadow-black/60 flex flex-col items-center gap-4"
          >
            {/* Call Status Header */}
            <div className="w-full flex items-center justify-between border-b border-zinc-900 pb-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                Voice Session
              </span>
              <span className="text-[10px] bg-zinc-800 text-zinc-300 font-extrabold px-2 py-0.5 rounded-full capitalize">
                {status}
              </span>
            </div>

            {/* User Avatar with Pulsing Rings */}
            <div className="relative my-2">
              {status === "active" && (
                <>
                  <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping duration-1000" />
                  <div className="absolute inset-2 rounded-full bg-green-500/10 animate-pulse duration-700" />
                </>
              )}
              <Avatar className="h-20 w-20 border-2 border-zinc-800 relative z-10 shadow-lg">
                <AvatarImage src={callMeta.avatar} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                  {callMeta.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Caller Metadata */}
            <div className="text-center">
              <p className="font-bold text-sm text-white tracking-wide">{callMeta.name}</p>
              <p className="text-[10px] text-zinc-400 font-medium">{callMeta.role}</p>
            </div>

            {/* Call Duration / Connecting message */}
            <div className="text-center font-mono text-sm font-semibold tracking-wider text-green-400">
              {status === "connecting" ? (
                <span className="text-zinc-400 text-xs animate-pulse">Establishing connection...</span>
              ) : status === "reconnecting" ? (
                <span className="text-amber-400 text-xs animate-pulse">Reconnecting...</span>
              ) : (
                formatDuration(callDuration)
              )}
            </div>

            {/* Settings context details (quality & suppression) */}
            <div className="w-full bg-zinc-900/40 border border-zinc-900 rounded-xl px-3 py-2 flex justify-between items-center text-[9px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Sliders className="w-2.5 h-2.5" /> Quality: <strong className="text-zinc-300 uppercase">{audioQuality}</strong>
              </span>
              {noiseCancellation && (
                <span className="bg-green-950/40 text-green-400 px-1.5 py-0.5 rounded font-extrabold">
                  ANC ACTIVE
                </span>
              )}
            </div>

            {/* Call Controls Bar */}
            <div className="w-full flex items-center justify-center gap-3 mt-1">
              {/* Mute Button */}
              <Button
                size="icon"
                onClick={isMuted ? unmute : mute}
                className={`h-10 w-10 rounded-full transition-all border border-zinc-800 ${
                  isMuted 
                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                }`}
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              {/* Speaker Toggle */}
              <Button
                size="icon"
                onClick={() => setSpeaker(!speakerEnabled)}
                className={`h-10 w-10 rounded-full transition-all border border-zinc-800 ${
                  speakerEnabled 
                    ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" 
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                }`}
                aria-label={speakerEnabled ? "Speaker disabled" : "Speaker enabled"}
              >
                {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>

              {/* Reconnect / Signal Fix */}
              <Button
                size="icon"
                onClick={reconnectCall}
                className="h-10 w-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
                title="Reconnect Audio"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>

              {/* Hang Up Button */}
              <Button
                size="icon"
                onClick={endCall}
                className="h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all"
                aria-label="Hang up call"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CommunicationContext.Provider>
  );
};

export const useCommunication = () => {
  const context = useContext(CommunicationContext);
  if (!context) {
    throw new Error("useCommunication must be used within a CommunicationProvider");
  }
  return context;
};
