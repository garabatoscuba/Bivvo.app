import { useState, useRef } from "react";
import { X, CheckCheck, ExternalLink, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BivooState } from "./BivooFace";
import bivooFaceSvg from "@/assets/bivoo-face.svg";
import AssistantChat from "./AssistantChat";

const NOTIFICATION_COLORS: Record<string, string> = {
  storefront_order: "bg-primary",
  low_stock: "bg-warning",
  sale_cancelled: "bg-destructive",
  business_request_approved: "bg-primary",
  business_request_rejected: "bg-destructive",
};

type PanelView = "main" | "read-notifications";

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
  onStateChange: (state: BivooState) => void;
  canNotifications?: boolean;
  canChat?: boolean;
}

export default function AssistantPanel({ open, onClose, onStateChange, canNotifications = true, canChat = false }: AssistantPanelProps) {
  const { profile, isOwner, isManager } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [view, setView] = useState<PanelView>("main");

  const { data: assistantConfig } = useQuery({
    queryKey: ['assistant-config-name'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_config').select('assistant_name').limit(1).single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const assistantName = (assistantConfig as any)?.assistant_name || 'Bivoo';

  const { data: announcements = [] } = useQuery({
    queryKey: ['panel-announcements', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const now = new Date().toISOString();
      const { data: anns } = await supabase
        .from('platform_announcements')
        .select('*')
        .eq('is_active', true)
        .lte('starts_at', now)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!anns || anns.length === 0) return [];
      const { data: dismissals } = await supabase
        .from('announcement_dismissals')
        .select('announcement_id')
        .eq('user_id', profile.user_id);
      const dismissedIds = new Set((dismissals || []).map((d: any) => d.announcement_id));
      return (anns as any[]).filter(a => {
        if (a.is_persistent) return !(a.expires_at && new Date(a.expires_at) < new Date());
        if (dismissedIds.has(a.id)) return false;
        if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
        return true;
      });
    },
    enabled: !!profile?.user_id,
    staleTime: 2 * 60 * 1000,
  });

  const dismissAnnouncement = useMutation({
    mutationFn: async (announcementId: string) => {
      await supabase.from('announcement_dismissals').insert({
        announcement_id: announcementId,
        user_id: profile!.user_id,
      } as any);
    },
  });
  const [dismissedLocal, setDismissedLocal] = useState<Set<string>>(new Set());

  const handleDismissAnnouncement = (id: string) => {
    setDismissedLocal(prev => new Set(prev).add(id));
    dismissAnnouncement.mutate(id);
  };

  const visibleAnnouncements = announcements.filter((a: any) => a.is_persistent || !dismissedLocal.has(a.id));

  const showNotifications = canNotifications && (isOwner || isManager);
  const unreadNotifs = notifications.filter((n) => !n.is_read);
  const readNotifs = notifications.filter((n) => n.is_read);

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-2 left-2 z-[60] max-h-[90vh] flex flex-col rounded-2xl border bg-card shadow-xl animate-scale-in overflow-hidden sm:left-auto sm:right-4 sm:w-[380px] sm:max-h-[75vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
          <img src={bivooFaceSvg} alt="Bivoo" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Asistente {assistantName}</p>
          <p className="text-[11px] text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            En línea
          </p>
        </div>
        <div className="flex items-center gap-1">
          {showNotifications && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7 relative", view === "read-notifications" && "text-primary")}
              onClick={() => setView(prev => prev === "read-notifications" ? "main" : "read-notifications")}
              title="Notificaciones leídas"
            >
              <Bell className="h-4 w-4" />
              {readNotifs.length > 0 && view !== "read-notifications" && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View: Read notifications (bell) */}
      {view === "read-notifications" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {readNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sin notificaciones leídas</p>
            </div>
          ) : (
            <div className="divide-y">
              <div className="px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Leídas · {readNotifs.length}
                </span>
              </div>
              {readNotifs.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2 px-4 py-2.5 opacity-60"
                >
                  <div className="w-[3px] self-stretch rounded-full bg-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-tight truncate">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View: Main (default) = announcements + unread notifs + chat */}
      {view === "main" && (
        <>
          {/* Announcements */}
          {visibleAnnouncements.length > 0 && (
            <div className="shrink-0 border-b">
              <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
                {visibleAnnouncements.map((a: any) => (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-2 hover:bg-muted/40 transition-colors">
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
                    {!a.is_persistent && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDismissAnnouncement(a.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unread notifications */}
          {showNotifications && unreadNotifs.length > 0 && (
            <div className="shrink-0 border-b">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Nuevas · {unreadNotifs.length}
                </span>
                {unreadNotifs.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1" onClick={markAllAsRead}>
                    <CheckCheck className="h-3 w-3" /> Marcar todas
                  </Button>
                )}
              </div>
              <div className="max-h-[130px] overflow-y-auto scrollbar-hide">
                {unreadNotifs.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className="w-full text-left flex items-start gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className={cn("w-[3px] self-stretch rounded-full shrink-0", NOTIFICATION_COLORS[n.type] || "bg-primary")} />
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

          {/* Chat (with quick questions built in) */}
          {canChat ? (
            <AssistantChat onStateChange={onStateChange} assistantName={assistantName} />
          ) : (
            /* Empty state when no chat */
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {visibleAnnouncements.length === 0 && unreadNotifs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden mb-3">
                    <img src={bivooFaceSvg} alt="Bivoo" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm text-muted-foreground">Sin novedades por ahora 👍</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
