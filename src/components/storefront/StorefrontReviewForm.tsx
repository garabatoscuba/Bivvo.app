import { useState } from 'react';
import { Star, Loader2, CheckCircle, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  branchId: string;
  accent: string;
}

const StorefrontReviewForm = ({ branchId, accent }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [affiliateId, setAffiliateId] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!affiliateId.trim() || rating === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
        body: JSON.stringify({ action: 'submit_review', branch_id: branchId, affiliate_id: affiliateId.trim(), rating, comment }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Error al enviar reseña');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center space-y-2 bg-card">
        <CheckCircle className="h-8 w-8 mx-auto" style={{ color: accent }} />
        <p className="text-sm font-medium text-foreground">¡Reseña enviada!</p>
        <p className="text-xs text-muted-foreground">Será visible una vez aprobada por el negocio.</p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="text-center">
        <h3
          className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-2"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          ¿Qué te pareció?
        </h3>
        <p className="text-sm text-muted-foreground mb-6">Comparte tu experiencia con otros clientes.</p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Dejar reseña
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-6 space-y-5 bg-card">
      <p className="text-xs text-muted-foreground">Solo clientes afiliados pueden dejar reseñas.</p>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">ID de afiliado</label>
        <input
          value={affiliateId}
          onChange={(e) => setAffiliateId(e.target.value)}
          placeholder="Tu ID de afiliado"
          className="w-full h-10 px-4 rounded-full border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Puntuación</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(i)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={28}
                className={i <= (hoverRating || rating) ? 'fill-current' : 'text-muted-foreground/20'}
                style={i <= (hoverRating || rating) ? { color: accent } : undefined}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Comentario (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="¿Qué te pareció?"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading || !affiliateId.trim() || rating === 0}
        className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar reseña'}
      </button>
    </div>
  );
};

export default StorefrontReviewForm;
