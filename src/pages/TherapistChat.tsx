import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from "wouter";
import { AppLayout } from '@/components/layout/AppLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Mic, PhoneCall, ShieldCheck, AlertOctagon, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCommunication } from '@/services/communication/CommunicationProvider';
import { useToast } from '@/hooks/use-toast';
import { socket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';

export default function TherapistChat() {
  const [, setLocation] = useLocation();
  const { startCall } = useCommunication();
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const appointmentId = new URLSearchParams(window.location.search).get('appointmentId');
  const emergencySessionId = new URLSearchParams(window.location.search).get('emergencySession');
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Active Emergency Session State
  const [activeSession, setActiveSession] = useState<any>(null);
  const [activeCase, setActiveCase] = useState<any>(null);

  useEffect(() => {
    if (!appointmentId || emergencySessionId) return;
    api.appointments.getConversation(appointmentId).then(({ conversation, messages }) => {
      setConversation(conversation);
      setMessages(messages.map((message: any) => ({ ...message, id: message._id, sender: message.senderId })));
      socket.connect();
      socket.emit('conversation:join', conversation._id);
      socket.on('message:receive', (message: any) => setMessages(previous => [...previous, { ...message, id: message._id, sender: message.senderId }]));
    }).catch((error) => toast({ variant: 'destructive', title: 'Chat unavailable', description: error.message }));
    return () => { socket.off('message:receive'); };
  }, [appointmentId, emergencySessionId]);

  useEffect(() => {
    const sessionId = emergencySessionId;
    if (!sessionId) return;
    api.crisis.getEmergencyMessages(sessionId).then(({ session, messages }) => {
      setActiveSession(session);
      setMessages(messages.map((message: any) => ({ ...message, id: message._id, sender: message.senderId })));
    }).catch((error) => toast({ variant: 'destructive', title: 'Emergency chat unavailable', description: error.message }));
  }, [emergencySessionId, toast]);

  useEffect(() => {
    api.crisis.getActiveSession().then(res => {
      if (res && res.activeSession) {
        setActiveSession(res.activeSession);
        setActiveCase(res.activeCase);
      }
    }).catch(err => console.error(err));
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || (!appointmentId && !emergencySessionId)) return;

    const newMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const result = emergencySessionId
        ? await api.crisis.sendEmergencyMessage(emergencySessionId, inputValue)
        : appointmentId
          ? await api.appointments.sendMessage(appointmentId, inputValue)
          : null;
      if (!result) return;
      const { message } = result;
      setMessages(previous => [...previous, { ...message, id: message._id, sender: message.senderId }]);
      setInputValue('');
    } catch (error: any) { toast({ variant: 'destructive', title: 'Message not sent', description: error.message }); }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const therapist = activeSession?.therapistId;
  const therapistName = therapist?.name || 'Therapist';

  return (
    <AppLayout>
      <PageTransition>
        <div className="h-[calc(100vh-6rem)] flex gap-6">
          <div className="flex-1 flex flex-col bg-card rounded-3xl border border-border shadow-sm overflow-hidden max-w-4xl mx-auto w-full">
            {/* Crisis active banner */}
            {activeSession && (
              <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between text-xs font-semibold shrink-0">
                <span className="flex items-center gap-1.5 animate-pulse">
                  <AlertOctagon className="w-4 h-4" /> EMERGENCY CRISIS WORKFLOW ACTIVE
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">
                  Price: ₹0 (Waived)
                </span>
              </div>
            )}

            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={therapist?.avatar} />
                  <AvatarFallback>{therapistName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold text-foreground">{therapistName}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-green-500" /> Secure Connection
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={async () => {
                    try {
                      await startCall(String(activeSession?.therapistId?._id || activeSession?.therapistId || ''), {
                        name: therapistName,
                        avatar: therapist?.avatar || "",
                        role: "Clinical Psychologist"
                      });
                      toast({
                        title: "Voice call initiated",
                        description: "Connecting to secure HIPAA-compliant voice consultation room.",
                      });
                    } catch (err: any) {
                      toast({
                        variant: "destructive",
                        title: "Call failed",
                        description: err.message || "Failed to start call."
                      });
                    }
                  }}
                  variant="outline"
                  className="rounded-full shadow-sm text-primary border-primary/20 hover:bg-primary/5 text-xs font-semibold"
                >
                  <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Voice Call
                </Button>
                <Button
                  onClick={() => {
                      toast({
                        title: 'Therapist Session Closed',
                        description: 'Returning to AI Companion safe space.',
                      });
                      setLocation('/ai-assistant');
                    }}
                  variant="outline"
                  className="rounded-full shadow-sm text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-extrabold"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> End / Close Chat
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6">
                {messages.map((msg) => {
                  // Appointment messages store the sender as a user ObjectId,
                  // rather than the old "user" / "therapist" display label.
                  const senderId = String(msg.senderId || msg.sender || '');
                  const isOwnMessage = senderId === String(user?.id || '') || msg.sender === 'user';
                  return (
                  <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwnMessage && (
                        <Avatar className="h-8 w-8 shrink-0 mt-auto border border-border">
                          <AvatarFallback>{therapistName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}

                      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        <div className={`p-4 rounded-2xl ${isOwnMessage
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm'
                          }`}>
                          {msg.text}
                          {msg.distressFlagged && <Badge className="mt-2 bg-red-100 text-red-700 border-0 text-[10px]">Safety concern flagged</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 px-1">{msg.time}</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-background border-t border-border">
              <div className="flex items-center gap-2 bg-muted p-2 rounded-full border border-border focus-within:border-primary/50 transition-colors">
                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground shrink-0">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={emergencySessionId ? `Message ${therapistName}...` : "Type a secure message..."}
                  className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 h-10 px-0 text-sm"
                />
                <Button onClick={handleSend} size="icon" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-sm">
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Therapist sidebar details */}
          {activeSession && (
            <div className="w-80 bg-white border border-border rounded-3xl p-5 shadow-sm space-y-5 hidden lg:block h-fit shrink-0">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-2">Distress Case Insight</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Assessment Level</label>
                  <Badge className="bg-red-100 text-red-700 text-xs border-0 font-extrabold block w-fit mt-1">
                    CRITICAL concern
                  </Badge>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Previous Mood Scores</label>
                  <div className="flex gap-1.5 mt-1">
                    {["😞 1/5", "😕 2/5", "😐 3/5"].map((m, i) => (
                      <span key={i} className="text-xs bg-gray-50 border border-gray-200 px-2 py-1 rounded-xl font-medium text-gray-700">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Journal Insight highlights</label>
                  <div className="mt-1 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600 leading-relaxed italic">
                    "Feeling overwhelmed by work burnout and loneliness. Hard to find reasons to keep trying..."
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </AppLayout>
  );
}
