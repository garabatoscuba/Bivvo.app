import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Home, ArrowRight } from "lucide-react";
import type { WeekSchedule } from "@/hooks/useStoreSettings";

interface PublicBusiness {
  id: string;
  name: string;
  slug: string | null;
  business_type: string;
  keywords: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
  schedule: WeekSchedule | null;
  address: string | null;
}

const DAY_KEYS: Record<number, keyof WeekSchedule> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
  4: "thursday", 5: "friday", 6: "saturday",
};

const isOpenNow = (schedule: WeekSchedule | null): boolean => {
  if (!schedule) return false;
  const now = new Date();
  const day = schedule[DAY_KEYS[now.getDay()]];
  if (!day?.enabled || !day.open || !day.close) return false;
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return cur >= day.open && cur < day.close;
};

const businessTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    store: "Tienda",
    copy_shop: "Punto de copias",
    "estaurente/safetería": "Restaurante",
    gym: "Gimnasio",
  };
  return map[type] || type;
};

const FILLS = ["hub-fill-green", "hub-fill-purple", "hub-fill-gold", "hub-fill-blue", "hub-fill-teal", "hub-fill-red", "hub-fill-amber"];

const portalBgStyle = (biz: PublicBusiness): React.CSSProperties => {
  if (biz.hero_image_url) {
    return { backgroundImage: `url(${biz.hero_image_url})` };
  }
  if (biz.accent_color) {
    return { backgroundColor: biz.accent_color };
  }
  return {};
};

const fallbackFill = (biz: PublicBusiness, idx: number) =>
  !biz.hero_image_url && !biz.accent_color ? FILLS[idx % FILLS.length] : "";

const getKeywordChips = (k: string | null) =>
  k ? k.split(",").map(s => s.trim()).filter(Boolean).slice(0, 4) : [];

interface PortalCardProps {
  biz: PublicBusiness;
  size: "sm" | "md" | "lg" | "xl";
  height?: string;
  aspectClass?: string;
  rounded?: string;
  showTags?: boolean;
  showLocation?: boolean;
  overlayStrong?: boolean;
  padding?: string;
  fillIdx: number;
}

const PortalCard = ({
  biz, size, height, aspectClass, rounded = "rounded-[8px]",
  showTags, showLocation, overlayStrong, padding, fillIdx,
}: PortalCardProps) => {
  const navigate = useNavigate();
  const open = isOpenNow(biz.schedule);
  const fill = fallbackFill(biz, fillIdx);
  const tags = getKeywordChips(biz.keywords);
  const handle = () => biz.slug && navigate(`/s/${biz.slug}`);

  return (
    <div
      className={`hub-portal ${rounded} ${aspectClass || ""}`}
      style={height ? { height } : undefined}
      onClick={handle}
    >
      <div
        className={`hub-portal-bg ${fill} ${aspectClass || ""}`}
        style={{ ...portalBgStyle(biz), ...(height ? { height } : {}) }}
      >
        <div className={`hub-portal-overlay ${overlayStrong ? "hub-portal-overlay-strong" : ""}`} />
        <div className="hub-portal-info" style={padding ? { padding } : undefined}>
          <div className={`hub-portal-badge ${open ? "open" : "closed"}`}>
            {open ? "Abierto" : "Cerrado"}
          </div>
          <div className={`hub-portal-name ${size}`}>{biz.name}</div>
          <div className="hub-portal-type" style={size === "xl" ? { fontSize: 14, marginTop: 6 } : undefined}>
            {businessTypeLabel(biz.business_type)}
            {showLocation && biz.address ? ` · ${biz.address}` : ""}
          </div>
          {showTags && tags.length > 0 && (
            <div className="hub-portal-tags" style={size === "xl" ? { marginTop: 14 } : undefined}>
              {tags.map(t => <span key={t} className="hub-portal-tag">{t}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface HubEditorialProps {
  userCoords?: { lat: number; lon: number } | null;
  onCreateBusiness: () => void;
}

const HubEditorial = ({ onCreateBusiness }: HubEditorialProps) => {
  const navigate = useNavigate();

  const { data: portals = [] } = useQuery({
    queryKey: ["hub-editorial-portals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_public_storefronts");
      if (error || !data) return [];
      return (data as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        business_type: row.business_type,
        keywords: row.keywords,
        logo_url: row.logo_url,
        hero_image_url: row.hero_image_url,
        accent_color: row.accent_color,
        schedule: row.schedule as WeekSchedule | null,
        address: row.address,
      })) as PublicBusiness[];
    },
  });

  // Sort by created_at fallback (no coords yet); slot helpers
  const ordered = useMemo(() => portals, [portals]);

  // Distribute portals across sections (cycling if not enough)
  const get = (count: number, offset = 0): PublicBusiness[] => {
    if (ordered.length === 0) return [];
    return Array.from({ length: count }, (_, i) => ordered[(offset + i) % ordered.length]);
  };

  const comunidad = get(5, 0);
  const hero1 = ordered[0];
  const grid4x3 = get(12, 1);
  const hero2 = ordered[Math.min(1, ordered.length - 1)];
  const grid3 = get(3, 2);
  const hero3 = ordered[Math.min(2, ordered.length - 1)];
  const grid3x2 = get(6, 3);

  if (ordered.length === 0) return null;

  return (
    <div className="space-y-14">
      {/* COMUNIDAD */}
      <section className="px-10">
        <div className="flex items-baseline justify-between mb-5">
          <div className="font-['Cormorant_Garamond'] text-[13px] tracking-[0.12em] uppercase hub-text-muted">
            Ayúdanos a crecer como comunidad
          </div>
          <div className="text-xs hub-text-dim cursor-pointer hover:hub-text-muted transition-colors">
            Invitar a un amigo →
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {comunidad.map((biz, i) => (
            <PortalCard key={`com-${biz.id}-${i}`} biz={biz} size="sm" aspectClass="aspect-[4/3]" rounded="rounded-[10px]" fillIdx={i} />
          ))}
        </div>

        {/* Anuncios — separados con borde sutil y más compactos */}
        <div className="mt-10 pt-8 border-t border-[var(--hub-border)]">
          <div className="flex items-baseline justify-between mb-4">
            <div className="font-['Cormorant_Garamond'] text-[13px] tracking-[0.12em] uppercase hub-text-muted">
              Ofertas y novedades
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {comunidad.slice(0, 4).map((biz, i) => (
              <div
                key={`anu-${biz.id}-${i}`}
                className="hub-anuncio !p-3 !gap-2"
                onClick={() => biz.slug && navigate(`/s/${biz.slug}`)}
              >
                <div
                  className="hub-anuncio-icon !h-8 !w-8 !text-[11px] flex-shrink-0"
                  style={{
                    background: i % 2 === 0 ? "rgba(29,158,117,0.1)" : "rgba(123,111,212,0.1)",
                    color: i % 2 === 0 ? "var(--hub-green)" : "var(--hub-purple)",
                  }}
                >
                  {biz.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="hub-anuncio-eyebrow text-[10px] truncate">
                    {biz.name} · {i % 2 === 0 ? "Oferta" : "Novedad"}
                  </div>
                  <div className="hub-anuncio-title text-[13px] leading-tight truncate">
                    {i % 2 === 0 ? "Descubre sus ofertas" : "Nuevos productos"}
                  </div>
                </div>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full self-start flex-shrink-0"
                  style={{
                    background: i % 2 === 0 ? "rgba(224,85,85,0.12)" : "rgba(29,158,117,0.12)",
                    color: i % 2 === 0 ? "var(--hub-red)" : "var(--hub-green)",
                  }}
                >
                  {i % 2 === 0 ? "Oferta" : "Nuevo"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HERO 1 */}
      {hero1 && (
        <section className="w-full">
          <PortalCard
            biz={hero1}
            size="xl"
            height="520px"
            rounded="rounded-none"
            showTags
            showLocation
            overlayStrong
            padding="40px"
            fillIdx={0}
          />
        </section>
      )}

      {/* GRID 4x3 — Tu negocio puede estar en Bivoo */}
      <section className="px-10">
        <h2 className="font-['Cormorant_Garamond'] text-[40px] font-normal text-center mb-7 tracking-[-0.3px] hub-text">
          Tu negocio puede estar <em className="italic text-[hsl(var(--primary))]">en Bivoo</em>
        </h2>
        <div className="grid grid-cols-4 gap-1.5">
          {grid4x3.map((biz, i) => (
            <PortalCard key={`g4-${biz.id}-${i}`} biz={biz} size="sm" aspectClass="aspect-[4/3]" fillIdx={i + 1} />
          ))}
        </div>
      </section>

      {/* HERO 2 */}
      {hero2 && (
        <section className="w-full mt-13">
          <PortalCard
            biz={hero2}
            size="xl"
            height="480px"
            rounded="rounded-none"
            showTags
            showLocation
            overlayStrong
            padding="40px"
            fillIdx={1}
          />
        </section>
      )}

      {/* FRANJA PRUEBA */}
      <section className="hub-franja mt-13" onClick={onCreateBusiness}>
        <div className="flex items-center gap-4">
          <div className="hub-franja-icon">
            <Home className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="font-['Cormorant_Garamond'] text-[22px] font-medium hub-text mb-1">
              Probar Bivoo como negocio ahora
            </div>
            <p className="text-xs hub-text-muted max-w-[480px] leading-relaxed">
              Crea tu negocio gratis, sin límite de tiempo. Inventario, punto de venta, empleados, portal público y más. Tu negocio aparecerá en el directorio para que otros usuarios te encuentren.
            </p>
          </div>
        </div>
        <button className="hub-franja-cta" onClick={(e) => { e.stopPropagation(); onCreateBusiness(); }}>
          Crear mi negocio
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </section>

      {/* GRID 3 */}
      <section className="px-10 mt-13">
        <div className="grid grid-cols-3 gap-1.5">
          {grid3.map((biz, i) => (
            <PortalCard
              key={`g3-${biz.id}-${i}`}
              biz={biz}
              size="md"
              height="300px"
              rounded="rounded-[10px]"
              showTags
              showLocation
              fillIdx={i + 3}
            />
          ))}
        </div>
      </section>

      {/* HERO 3 */}
      {hero3 && (
        <section className="w-full mt-13">
          <PortalCard
            biz={hero3}
            size="xl"
            height="460px"
            rounded="rounded-none"
            showTags
            showLocation
            overlayStrong
            padding="40px"
            fillIdx={2}
          />
        </section>
      )}

      {/* GRID 3x2 FINAL */}
      <section className="px-10 mt-13 mb-13">
        <div className="grid grid-cols-3 gap-1.5">
          {grid3x2.map((biz, i) => (
            <PortalCard key={`g32-${biz.id}-${i}`} biz={biz} size="sm" aspectClass="aspect-[16/9]" fillIdx={i + 4} />
          ))}
        </div>
      </section>

      {/* CIERRE */}
      <section className="py-[72px] px-10 text-center border-t border-[var(--hub-border)]">
        <div className="font-['DM_Sans'] font-light text-[32px] tracking-[4px] hub-text mb-2">
          Bivo<span className="text-[hsl(var(--primary))]">o</span>
        </div>
        <div className="font-['Cormorant_Garamond'] text-[18px] italic hub-text-muted mb-8">
          Automatización de empresas
        </div>
        <div className="flex items-center justify-center gap-3">
          <button className="hub-cierre-btn-outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Ver directorio completo
          </button>
          <button className="hub-cierre-btn-solid" onClick={onCreateBusiness}>
            Crear mi negocio
          </button>
        </div>
      </section>
    </>
  );
};

export default HubEditorial;
