import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Square, Play, Pause, Phone } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface Message {
  id: string;
  sender: "user" | "other";
  text: string;
  time: string;
  isVoice?: boolean;
  audioUrl?: string;
  voiceDuration?: string;
  isDistress?: boolean;
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (text: string, isVoice?: boolean, audioUrl?: string, duration?: string) => void;
  otherAvatar: string;
  otherName: string;
  onStartVoiceCall?: () => void;
}

export function ChatWindow({ messages, onSendMessage, otherAvatar, otherName, onStartVoiceCall }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    onSendMessage(trimmedValue);
    setInputValue("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const mins = Math.floor(recordingSeconds / 60);
        const secs = recordingSeconds % 60;
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        onSendMessage("🎙️ Voice Note", true, audioUrl, durationStr);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone permission denied or unsupported device.");
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 sm:p-6" aria-label={`Conversation with ${otherName}`}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[85%] gap-3 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {message.sender === "other" ? (
                  <Avatar className="mt-auto h-8 w-8 shrink-0 border border-emerald-200">
                    <AvatarImage src={otherAvatar} alt={otherName} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-xs">
                      {otherName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : null}

                <div className={`flex flex-col ${message.sender === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${
                      message.sender === "user"
                        ? "rounded-br-sm bg-emerald-600 text-white font-medium"
                        : "rounded-bl-sm bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-200"
                    }`}
                  >
                    {message.isVoice && message.audioUrl ? (
                      <div className="space-y-2 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">🎙️ Voice Note</span>
                          {message.voiceDuration && (
                            <Badge className="bg-white/20 text-white border-0 text-[10px]">
                              {message.voiceDuration}
                            </Badge>
                          )}
                        </div>
                        <audio controls src={message.audioUrl} className="w-full h-8 rounded-lg outline-none" />
                      </div>
                    ) : (
                      message.text
                    )}
                    {message.isDistress && <Badge className="mt-2 bg-red-100 text-red-700 border-0 text-[10px]">Safety check in progress</Badge>}
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-gray-400 font-medium">{message.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        className="border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
      >
        {isRecording ? (
          <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-2.5 rounded-2xl animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
              <span className="text-xs font-black text-red-600">
                Recording Voice Note... ({recordingSeconds}s)
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={cancelRecording} variant="outline" className="rounded-xl text-xs h-8">
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={stopAndSendRecording} className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs h-8 font-bold">
                Send Voice Note
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-2 focus-within:border-emerald-500">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Type a confidential message..."
              className="h-10 flex-1 border-none bg-transparent px-3 text-xs shadow-none focus-visible:ring-0"
              aria-label="Message input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl text-emerald-600 hover:bg-emerald-100"
              type="button"
              onClick={startRecording}
              title="Record Voice Note"
            >
              <Mic className="h-5 w-5" />
            </Button>
            {onStartVoiceCall && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-emerald-600 hover:bg-emerald-100"
                type="button"
                onClick={onStartVoiceCall}
                title="Start Voice Call"
              >
                <Phone className="h-5 w-5" />
              </Button>
            )}
            <Button size="icon" className="shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 h-10 w-10 shadow-md" type="submit">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
