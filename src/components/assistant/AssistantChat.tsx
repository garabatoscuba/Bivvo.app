import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
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

interface AssistantChatProps {
  onStateChange: (state: BivooState) => void;
  assistantName: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function AssistantChat({ onStateChange, assistantName }: AssistantChatProps) {
  const { profile, isOwner, isManager, isSeller, isSuperAdmin } = useAuth();
  const { pathname } = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
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
          active_module: pathname.replace("/", "") || "dashboard",
          business_id: profile?.business_id || null,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Assistant error:", res.status, errText);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Lo siento, ocurrió un error. Intenta de nuevo." },
        ]);
        onStateChange("idle");
        setIsStreaming(false);
        return;
      }

      onStateChange("responding");

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      // Add empty assistant message
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
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantText,
                };
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
  }, [input, isStreaming, messages, onStateChange, pathname, profile?.business_id, userRole]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full overflow-hidden mb-3">
              <img src={bivooFaceSvg} alt={assistantName} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-medium">¡Hola! Soy {assistantName}</p>
            <p className="text-xs text-muted-foreground mt-1">¿En qué puedo ayudarte hoy?</p>
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
            onClick={sendMessage}
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
