import { useState } from 'react';
import { Gift, Loader2, CheckCircle, Star } from 'lucide-react';

interface Props {
  branchId: string;
  accent: string;
  apiBase: string;
  apiKey: string;
}

const StorefrontAffiliateForm = ({ branchId, accent, apiBase, apiKey }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const filledCount = [name.trim(), phone.trim(), email.trim()].filter(Boolean).length;

  const handleSubmit = async () => {
    if (filledCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ action: 'register_affiliate', branch_id: branchId, name, phone, email }),
      });
      const data = await res.json();
      if (data.success) {
        setEarnedPoints(data.affiliate.points);
        setSuccess(true);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-border p-6 text-center space-y-3 bg-card">
        <CheckCircle className="h-10 w-10 mx-auto" style={{ color: accent }} />
        <p className="text-sm font-medium text-foreground">¡Te has unido exitosamente!</p>
        <p className="text-xs text-muted-foreground">Ganaste <span className="font-semibold" style={{ color: accent }}>{earnedPoints} puntos</span> de bienvenida.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-medium text-white transition-all hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        <Gift className="h-4 w-4" />
        Únete y gana puntos
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-5 space-y-4 bg-card">
      <div className="text-center space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Programa de fidelización</h3>
        <p className="text-xs text-muted-foreground">Completa tus datos y gana puntos. Ningún campo es obligatorio.</p>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Nombre</label>
            {name.trim() && <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: accent }}><Star className="h-2.5 w-2.5" /> +10 pts</span>}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Teléfono</label>
            {phone.trim() && <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: accent }}><Star className="h-2.5 w-2.5" /> +10 pts</span>}
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Tu teléfono"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Email</label>
            {email.trim() && <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: accent }}><Star className="h-2.5 w-2.5" /> +10 pts</span>}
          </div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu email"
            type="email"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || filledCount === 0}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {filledCount > 0 ? `Unirme (+${filledCount * 10} pts)` : 'Completa al menos un campo'}
      </button>
    </div>
  );
};

export default StorefrontAffiliateForm;
