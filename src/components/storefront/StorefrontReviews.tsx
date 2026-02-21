import { useState } from 'react';
import { Star, MessageSquare, Loader2, CheckCircle } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author: string;
}

interface Props {
  reviews: Review[];
  branchId: string;
  accent: string;
  apiBase: string;
  apiKey: string;
}

const Stars = ({ count, size = 14, color }: { count: number; size?: number; color: string }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        className={i <= count ? 'fill-current' : 'text-muted-foreground/20'}
        style={i <= count ? { color } : undefined}
        size={size}
      />
    ))}
  </div>
);

const StorefrontReviews = ({ reviews, branchId, accent, apiBase, apiKey }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [affiliateId, setAffiliateId] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleSubmit = async () => {
    if (!affiliateId.trim() || rating === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2
            className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Reseñas
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Stars count={Math.round(avgRating)} color={accent} />
              <span className="text-sm font-medium text-foreground/80">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({reviews.length} reseñas)</span>
            </div>
          )}
        </div>
        {!showForm && !success && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Dejar reseña
          </button>
        )}
      </div>

      {/* Review form */}
      {showForm && !success && (
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
      )}

      {success && (
        <div className="rounded-2xl border border-border p-8 text-center space-y-2 bg-card">
          <CheckCircle className="h-8 w-8 mx-auto" style={{ color: accent }} />
          <p className="text-sm font-medium text-foreground">¡Reseña enviada!</p>
          <p className="text-xs text-muted-foreground">Será visible una vez aprobada por el negocio.</p>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground/40 text-center py-12">Aún no hay reseñas.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {reviews.map(review => (
          <div key={review.id} className="p-5 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{review.author}</span>
              <Stars count={review.rating} size={12} color={accent} />
            </div>
            {review.comment && (
              <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
            )}
            <p className="text-[10px] text-muted-foreground/40">
              {new Date(review.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorefrontReviews;
