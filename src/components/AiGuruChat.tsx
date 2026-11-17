import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage, Vehicle } from "../types";

interface AiGuruChatProps {
  vehicle: Vehicle;
}

export default function AiGuruChat({ vehicle }: AiGuruChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Suggested questions based on active vehicle type
  const evSuggestions = [
    "ทำอย่างไรให้แบตเตอรี่ EV มีอายุการใช้งานนานที่สุด?",
    "ควรชาร์จไฟตู้ DC บ่อยแค่ไหน? ส่งผลต่อแบตไหม?",
    "ขับรถไฟฟ้าลุยน้ำท่วมขังลึกๆ ปลอดภัยหรือไม่?",
    "เทคนิคการขับ EV เพื่อเพิ่มระยะวิ่งสัปดาห์นี้"
  ];

  const iceSuggestions = [
    "Gasohol 95 กับ E20 ควรเติมอะไรดีเมื่อคำนวณความประหยัด?",
    "เทคนิคขับประหยัดน้ำมันในเมืองที่รถติดหนัก",
    "ดูแลรักษาหัวเทียนและน้ำมันเครื่องเพื่อให้สิ้นเปลืองน้อยลง",
    "ไฟเตือนรูปเครื่องยนต์สีเหลืองติดโชว์ เกิดจากอะไรได้บ้าง?"
  ];

  const suggestions = vehicle.type === "EV" ? evSuggestions : iceSuggestions;

  useEffect(() => {
    // Add welcome message if chat is empty
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: `สวัสดีครับ! ผมคือ **กูรูรถยนต์อัจฉริยะ** ยินดีต้อนรับเข้าสู่ช่องทางตอบคำถามเรื่องรถยนต์และพลังงานอัจฉริยะ 🚙💨\n\nผมพร้อมให้คำแนะนำเรื่องการขับขี่ประหยัดน้ำมัน/ไฟ การดูแลเครื่องยนต์ ไฮบริด และแบตเตอรี่ EV สำหรับรถ **${vehicle.model || "ของคุณ"}** อย่างลึกซึ้ง มีข้อสงสัยหรือเจอปัญหาอะไร ถามเข้ามาได้เลยครับ!`,
          timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [vehicle.model, vehicle.type, messages.length]);

  useEffect(() => {
    // Scroll to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Map current history (excluding current user message and welcome ID) to API format
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
          vehicleContext: {
            type: vehicle.type,
            model: vehicle.model,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("เกิดข้อผิดพลาดในการเชื่อมต่อกับกูรู AI");
      }

      const resData = await response.json();
      if (resData.status === "success") {
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          text: resData.reply,
          timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(resData.error || "ไม่สามารถดึงข้อมูลคำตอบได้");
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        text: `⚠️ **ข้อผิดพลาด:** ไม่สามารถส่งข้อความได้เนื่องจากขัดข้องทางเทคนิค: ${err.message || "เซิร์ฟเวอร์ตอบรับช้า"}`,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Check if response has safety trigger keywords to render warning box
  const hasSafetyWarning = (text: string) => {
    const dangerWords = ["อันตราย", "ห้ามดัดแปลง", "ไฟฟ้าแรงสูง", "ศูนย์บริการ", "ช็อต", "ระเบิด"];
    return dangerWords.some((w) => text.toLowerCase().includes(w));
  };

  // Helper to format reply and render basic markdown bold/list items
  const formatReplyText = (text: string) => {
    return text.split("\n").map((line, index) => {
      let content: React.ReactNode = line;

      // Handle bold blocks e.g. **text**
      if (line.includes("**")) {
        const parts = line.split("**");
        content = parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-slate-950 font-bold">{part}</strong> : part));
      }

      // Handle list bullets
      if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
        return (
          <li key={index} className="ml-4 list-disc text-sm text-slate-700 leading-relaxed mb-1">
            {line.replace(/^[-*]\s*/, "")}
          </li>
        );
      }

      return (
        <p key={index} className="text-sm text-slate-700 leading-relaxed mb-1.5 min-h-[1.2rem]">
          {content}
        </p>
      );
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 flex flex-col h-[550px]">
      {/* Chat Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-800 text-sm">กูรูรถยนต์อัจฉริยะ AI</h3>
              <span className="bg-indigo-100 text-indigo-800 text-[9px] px-2 py-0.5 rounded-full font-bold">
                Online
              </span>
            </div>
            <p className="text-slate-400 text-xs">รอบรู้เรื่องระบบพลังงาน แบตเตอรี่ EV และเทคนิคการขับขี่</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm("คุณต้องการล้างประวัติการสนทนาทั้งหมดหรือไม่?")) {
              setMessages([]);
            }
          }}
          className="text-xs text-slate-400 hover:text-slate-600 font-bold"
        >
          ล้างแชท
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin">
        {messages.map((msg) => {
          const isAssistant = msg.role === "assistant";
          const isDangerAlert = isAssistant && hasSafetyWarning(msg.text);

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${!isAssistant ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  isAssistant ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-600"
                }`}
              >
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="max-w-[82%]">
                <div
                  className={`p-3.5 rounded-2xl text-sm ${
                    !isAssistant
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : isDangerAlert
                      ? "bg-amber-50/70 border border-amber-200 text-slate-800 rounded-tl-none shadow-xs"
                      : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none"
                  }`}
                >
                  {isDangerAlert && (
                    <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-xs mb-2 bg-amber-100/60 px-2 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" /> ข้อแนะนำด้านความปลอดภัยที่เข้มงวด
                    </div>
                  )}
                  <div className="space-y-1">{formatReplyText(msg.text)}</div>
                </div>
                <span className={`text-[10px] text-slate-400 mt-1 block ${!isAssistant ? "text-right" : ""}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="pb-3 pt-1 shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" /> หัวข้อสนทนาแนะนำ:
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-xs text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-750 hover:border-indigo-200 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-all text-left truncate max-w-full cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex gap-2 pt-3 border-t border-slate-100 shrink-0"
      >
        <input
          type="text"
          placeholder="ถามข้อมูลเทคนิครถ หรือวิธีประหยัดพลังงาน..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl shadow-md shadow-indigo-100/50 hover:shadow-lg transition-all flex items-center justify-center cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
