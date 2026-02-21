import { useState } from 'react';
import { MapPin, Phone, Send, Loader2, CheckCircle } from 'lucide-react';
import type { StorefrontData } from '@/pages/PublicStorefront';
import StorefrontSchedule from '@/components/storefront/StorefrontSchedule';
import StorefrontAbout from '@/components/storefront/StorefrontAbout';

const API_BASE = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  data: StorefrontData;
  accent: string;
}

const StorefrontContact = ({ data, accent }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const contactEmail = data.settings.contact_email;

  const handleSend = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY },
        body: JSON.stringify({
          action: 'send_contact',
          branch_id: data.branch.id,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) setSent(true);
      else setError(json.error || 'Error al enviar');
    } catch {
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-10 py-14 sm:py-20">
      <h1
        className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-12 text-center"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Contacto
      </h1>

      <div className="grid gap-12 md:grid-cols-2">
        {/* Schedule */}
        <div>
          <StorefrontSchedule schedule={data.settings.schedule} />
        </div>

        {/* Info & Socials */}
        <div className="space-y-8">
          {/* Address & Phone */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4">
              Información
            </h3>
            {data.branch.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {data.branch.address}
              </p>
            )}
            {data.branch.phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {data.branch.phone}
              </p>
            )}
          </div>

          {/* Socials */}
          <StorefrontAbout
            aboutText={null}
            socialInstagram={data.settings.social_instagram}
            socialFacebook={data.settings.social_facebook}
            socialTiktok={data.settings.social_tiktok}
            socialTwitter={data.settings.social_twitter}
          />
        </div>
      </div>

      {/* Contact form */}
      {contactEmail && (
        <div className="mt-16 max-w-md mx-auto">
          <h3
            className="text-lg font-bold tracking-tight text-foreground mb-6 text-center"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Envíanos un mensaje
          </h3>

          {sent ? (
            <div className="rounded-2xl border border-border p-8 text-center space-y-2 bg-card">
              <CheckCircle className="h-8 w-8 mx-auto" style={{ color: accent }} />
              <p className="text-sm font-medium text-foreground">¡Mensaje enviado!</p>
              <p className="text-xs text-muted-foreground">Te responderemos lo antes posible.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border p-6 space-y-4 bg-card">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={100}
                  className="w-full h-10 px-4 rounded-full border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  maxLength={255}
                  className="w-full h-10 px-4 rounded-full border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Mensaje</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="¿En qué podemos ayudarte?"
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                onClick={handleSend}
                disabled={sending || !name.trim() || !email.trim() || !message.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Enviar mensaje</>}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default StorefrontContact;
