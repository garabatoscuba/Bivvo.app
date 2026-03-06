import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Loader2, X, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import bivooFaceSvg from "@/assets/bivoo-face.svg";
import type { BivooState } from "./BivooFace";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  link_url?: string | null;
  link_label?: string | null;
  is_persistent?: boolean;
}

interface AssistantChatProps {
  onStateChange: (state: BivooState) => void;
  assistantName: string;
  announcements?: AnnouncementItem[];
  onDismissAnnouncement?: (id: string) => void;
}

const STORAGE_KEY = "bivoo-chat-history";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const { messages, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > ONE_DAY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return messages || [];
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, timestamp: Date.now() }));
  } catch { /* ignore quota errors */ }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Quick questions by current route/module */
const MODULE_QUESTIONS: Record<string, string[]> = {
  dashboard: [
    "¿Qué significa cada tarjeta del dashboard?",
    "¿Cómo interpreto las alertas de stock?",
  ],
  pos: [
    "¿Cómo proceso un pago mixto?",
    "¿Por qué no aparece un producto aquí?",
  ],
  inventory: [
    "¿Cómo agrego stock a un producto?",
    "¿Cuál es la diferencia entre almacén y venta?",
  ],
  services: [
    "¿Cómo creo un servicio nuevo?",
    "¿Qué es un servicio en vivo?",
  ],
  employees: [
    "¿Cómo agrego un empleado nuevo?",
    "¿Cómo inicio una jornada?",
  ],
  nomina: [
    "¿Cómo funciona el Mixto Personalizado?",
    "¿Cómo asigno una modalidad a un empleado?",
  ],
  tesoreria: [
    "¿Qué diferencia hay entre modo Real y Operativo?",
    "¿Cómo registro un gasto personal?",
  ],
  caja: [
    "¿Cómo abro y cierro la caja?",
    "¿Qué pasa con el dinero al cerrar la jornada?",
  ],
  sales: [
    "¿Cómo anulo una venta?",
    "¿Qué métodos de pago puedo usar?",
  ],
  settings: [
    "¿Cómo configuro el stock mínimo?",
    "¿Cómo agrego una sucursal?",
  ],
};

const DEFAULT_QUESTIONS = [
  "¿Por dónde empiezo a configurar mi negocio?",
  "¿Qué puedes ayudarme a hacer?",
];

export default function AssistantChat({ onStateChange, assistantName, announcements = [], onDismissAnnouncement }: AssistantChatProps) {
  const { profile, isOwner, isManager, isSeller, isSuperAdmin } = useAuth();
  const { pathname } = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedMessages());
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userRole = isSuperAdmin || isOwner
    ? "owner"
    : isManager
      ? "manager"
      : isSeller
        ? "seller"
        : "employee";

  const currentModule = pathname.replace("/", "").split("?")[0] || "dashboard";

  const quickQuestions = useMemo(() => {
    return MODULE_QUESTIONS[currentModule] || DEFAULT_QUESTIONS;
  }, [currentModule]);

  // Persist messages whenever they change (skip empty)
  useEffect(() => {
    if (messages.length > 0) persistMessages(messages);
  }, [messages]);

  const prevMsgCount = useRef(messages.length);
  const didMount = useRef(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (!didMount.current) {
      // On mount, scroll to top so announcements are visible
      scrollRef.current.scrollTop = 0;
      didMount.current = true;
    } else if (messages.length > prevMsgCount.current) {
      // New message added — scroll to bottom
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);
    onStateChange("thinking");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bivoo-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            content: m.content,
          })),
          role: userRole,
          active_module: currentModule,
          business_id: profile?.business_id || null,
        }),
      });

      if (!res.ok) {
        console.error("Assistant error:", res.status, await res.text());
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Lo siento, ocurrió un error. Intenta de nuevo." },
        ]);
        onStateChange("idle");
        setIsStreaming(false);
        return;
      }

      onStateChange("responding");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed?.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantText };
                return updated;
              });
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error de conexión. Verifica tu internet." },
      ]);
    } finally {
      onStateChange("idle");
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, onStateChange, currentModule, profile?.business_id, userRole]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Reset button */}
      {messages.length > 0 && (
        <div className="shrink-0 flex justify-end px-3 pt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearChat} title="Reiniciar chat">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-zinc-100 dark:bg-black/40 rounded-lg">
        {/* Inline announcements — scrollable with chat */}
        {announcements.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-xl border border-border/60 px-3 py-2.5 bg-muted/30">
                <div className="w-[3px] self-stretch rounded-full bg-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-tight">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{a.message}</p>
                  {a.link_url && (
                    <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary flex items-center gap-0.5 mt-0.5 hover:underline">
                      <ExternalLink className="h-3 w-3" /> {a.link_label || 'Ver más'}
                    </a>
                  )}
                </div>
                {!a.is_persistent && onDismissAnnouncement && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onDismissAnnouncement(a.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-6 pb-2 text-center">
            <div className="w-12 h-12 rounded-full overflow-hidden mb-3">
              <img src={bivooFaceSvg} alt={assistantName} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-medium">¡Hola! Soy {assistantName}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">¿En qué puedo ayudarte hoy?</p>

            {/* Quick questions */}
            <div className="w-full space-y-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={isStreaming}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:bg-muted/60 transition-colors text-foreground/80 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mt-0.5">
                <img src={bivooFaceSvg} alt={assistantName} className="w-full h-full object-cover" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              {m.content || (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Escribiendo...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            rows={1}
            className="flex-1 resize-none bg-muted/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[80px]"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="h-8 w-8 rounded-xl shrink-0"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
