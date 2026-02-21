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
    <section className="max-w-4xl mx-auto px-4 sm:px-10 py-14 sm:py-20">
      <h1
        className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-12 text-center"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Contacto
      </h1>

      {/* Info & Socials — top row */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-12 text-sm text-muted-foreground">
        {data.branch.address && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {data.branch.address}
          </span>
        )}
        {data.branch.phone && (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {data.branch.phone}
          </span>
        )}
      </div>

      {/* Socials */}
      <div className="flex justify-center mb-14">
        <StorefrontAbout
          aboutText={null}
          socialInstagram={data.settings.social_instagram}
          socialFacebook={data.settings.social_facebook}
          socialTiktok={data.settings.social_tiktok}
          socialTwitter={data.settings.social_twitter}
        />
      </div>

      {/* Schedule + Contact form side by side */}
      <div className={`grid gap-10 ${contactEmail ? 'md:grid-cols-2' : 'max-w-md mx-auto'}`}>
        {/* Schedule */}
        <div>
          <StorefrontSchedule schedule={data.settings.schedule} />
        </div>

        {/* Contact form */}
        {contactEmail && (
          <div>
            <h3
              className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4"
            >
              Envíanos un mensaje
            </h3>

            {sent ? (
              <div className="rounded-xl border border-border p-8 text-center space-y-2">
                <CheckCircle className="h-8 w-8 mx-auto" style={{ color: accent }} />
                <p className="text-sm font-medium text-foreground">¡Mensaje enviado!</p>
                <p className="text-xs text-muted-foreground">Te responderemos lo antes posible.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre"
                  maxLength={100}
                  className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  maxLength={255}
                  className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tu mensaje..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={handleSend}
                  disabled={sending || !name.trim() || !email.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: accent }}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Enviar</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default StorefrontContact;
