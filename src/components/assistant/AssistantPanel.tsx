import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "react-router-dom";
import type { BivooState } from "./BivooFace";
import bivooFaceSvg from "@/assets/bivoo-face.svg";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const NOTIFICATION_COLORS: Record<string, string> = {
  storefront_order: "bg-primary",
  low_stock: "bg-warning",
  sale_cancelled: "bg-destructive",
  business_request_approved: "bg-primary",
  business_request_rejected: "bg-destructive",
};

function getActiveModule(pathname: string): string {
  if (pathname.startsWith("/pos")) return "POS";
  if (pathname.startsWith("/inventory")) return "Inventario";
  if (pathname.startsWith("/services")) return "Servicios";
  if (pathname.startsWith("/caja")) return "Caja";
  if (pathname.startsWith("/employees")) return "Empleados";
  if (pathname.startsWith("/sales")) return "Ventas";
  if (pathname.startsWith("/cobros")) return "Reportes";
  if (pathname.startsWith("/orders")) return "Pedidos";
  if (pathname.startsWith("/nomina")) return "Nómina";
  if (pathname.startsWith("/settings")) return "Configuración";
  if (pathname.startsWith("/plans")) return "Planes";
  if (pathname.startsWith("/store-settings")) return "Portal";
  if (pathname === "/") return "Dashboard";
  return "General";
}

function getSuggestions(module: string): string[] {
  const map: Record<string, string[]> = {
    POS: ["¿Cómo registro una venta?", "¿Cómo aplico un descuento?", "¿Cómo cancelo una venta?"],
    Inventario: ["¿Cómo agrego un producto?", "¿Cómo configuro stock mínimo?", "¿Cómo hago una entrada de mercancía?"],
    Servicios: ["¿Cómo creo un servicio?", "¿Cómo cobro un servicio?", "¿Cómo veo los cobros del día?"],
    Caja: ["¿Cómo abro la caja del día?", "¿Cómo configuro el fondo fijo?", "¿Cómo cierro la caja?"],
    Empleados: ["¿Cómo agrego un empleado?", "¿Cómo asigno un rol?", "¿Cómo inicio una jornada?"],
    Ventas: ["¿Cómo filtro ventas por fecha?", "¿Cómo veo el detalle de una venta?", "¿Cómo exporto las ventas?"],
    Reportes: ["¿Cómo veo el resumen del día?", "¿Cómo comparo períodos?", "¿Cómo veo ventas por empleado?"],
    Nómina: ["¿Cómo configuro una modalidad?", "¿Cómo asigno un preset?", "¿Cómo calculo el salario?"],
    Dashboard: ["¿Cómo abro la caja del día?", "¿Cómo registro una venta?", "¿Cómo agrego un empleado?"],
  };
  return (
    map[module] || ["¿Cómo empiezo a usar Bivoo?", "¿Qué módulos tengo disponibles?", "¿Cómo configuro mi negocio?"]
  );
}

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
  onStateChange: (state: BivooState) => void;
}

export default function AssistantPanel({ open, onClose, onStateChange }: AssistantPanelProps) {
  const { profile, isOwner, isManager, isSeller } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showNotifications = isOwner || isManager;
  const unreadNotifs = notifications.filter((n) => !n.is_read);
  const activeModule = getActiveModule(location.pathname);
  const suggestions = getSuggestions(activeModule);

  // Role for the edge function
  const chatRole = isSeller ? "seller" : isManager ? "manager" : isOwner ? "owner" : "viewer";

  // No auto-focus on mobile to prevent keyboard from opening automatically

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: Message = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      onStateChange("thinking");

      let assistantContent = "";
      const allMessages = [...messages, userMsg];

      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bivoo-assistant`;
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            role: chatRole,
            active_module: activeModule,
            business_id: profile?.business_id || null,
          }),
        });

        if (!resp.ok || !resp.body) {
          throw new Error("Failed to connect");
        }

        onStateChange("responding");
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        const upsertAssistant = (chunk: string) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
            }
            return [...prev, { role: "assistant", content: assistantContent }];
          });
        };

        let streamDone = false;
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              /* ignore */
            }
          }
        }

        // Save the full conversation including assistant reply (fire-and-forget)
        if (assistantContent && profile?.business_id) {
          const finalMessages = [...allMessages, { role: "assistant" as const, content: assistantContent }];
          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
          const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
          fetch(`${SUPABASE_URL}/rest/v1/assistant_conversations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_KEY}`,
              apikey: SUPABASE_KEY,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify({
              business_id: profile.business_id,
              user_id: profile.user_id,
              user_role: chatRole,
              messages: finalMessages,
              updated_at: new Date().toISOString(),
            }),
          }).catch(() => {
            /* silent */
          });
        }
      } catch (e) {
        console.error("Assistant error:", e);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Lo siento, no pude conectarme. Intenta de nuevo." },
        ]);
      } finally {
        setIsLoading(false);
        onStateChange("idle");
      }
    },
    [messages, isLoading, chatRole, activeModule, profile?.business_id, onStateChange],
  );

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-2 left-2 z-[60] max-h-[75vh] flex flex-col rounded-2xl border bg-card shadow-xl animate-scale-in overflow-hidden sm:left-auto sm:right-4 sm:w-[380px] sm:max-h-[580px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
          <img src={bivooFaceSvg} alt="Bivoo" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Asistente Bivoo</p>
          <p className="text-[11px] text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            En línea
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Notifications section (owner/manager only) */}
      {showNotifications && unreadNotifs.length > 0 && (
        <div className="shrink-0 border-b">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Sin revisar · {unreadNotifs.length}
            </span>
            {unreadNotifs.length > 1 && (
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1" onClick={markAllAsRead}>
                <CheckCheck className="h-3 w-3" /> Todas
              </Button>
            )}
          </div>
          <div className="max-h-[140px] overflow-y-auto scrollbar-hide">
            {unreadNotifs.slice(0, 5).map((n) => (
              <button
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className="w-full text-left flex items-start gap-2 px-4 py-2 hover:bg-muted/40 transition-colors"
              >
                <div
                  className={cn(
                    "w-[3px] self-stretch rounded-full shrink-0",
                    NOTIFICATION_COLORS[n.type] || "bg-muted",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-tight truncate">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
                <CheckCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {/* Suggestions when empty */}
        {messages.length === 0 && (
          <>
            {showNotifications && unreadNotifs.length === 0 && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-2">Chat</p>
            )}
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-sm px-3 py-2 rounded-xl border hover:bg-muted/50 transition-colors text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Greeting bubble */}
            <div className="flex items-end gap-2 mt-3">
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                <img src={bivooFaceSvg} alt="Bivoo" className="w-full h-full object-cover" />
              </div>
              <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2 max-w-[85%]">
                <p className="text-sm">Hola {profile?.full_name?.split(" ")[0]} 👋 ¿En qué te ayudo hoy?</p>
              </div>
            </div>
          </>
        )}

        {/* Messages */}
        {messages.map((m, i) => {
          const isLastAssistant =
            m.role === "assistant" &&
            !isLoading &&
            (i === messages.length - 1 || messages.slice(i + 1).every((x) => x.role !== "assistant"));
          return (
            <div key={i}>
              <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start items-end gap-2")}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                    <img src={bivooFaceSvg} alt="Bivoo" className="w-full h-full object-cover" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/60 text-foreground rounded-bl-md",
                  )}
                >
                  {m.content}
                </div>
              </div>
              {isLastAssistant && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                  {suggestions.slice(0, 3).map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
              <img src={bivooFaceSvg} alt="Bivoo" className="w-full h-full object-cover" />
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2">
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="Escribe tu pregunta..."
          className="text-sm rounded-full h-9"
          disabled={isLoading}
        />
        <Button
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
          disabled={!input.trim() || isLoading}
          onClick={() => sendMessage(input)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
