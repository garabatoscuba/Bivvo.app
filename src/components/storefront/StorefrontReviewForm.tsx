import { useState } from 'react';
import { Star, Loader2, CheckCircle, MessageSquare, Phone } from 'lucide-react';

const API_BASE = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  branchId: string;
  accent: string;
  productName?: string | null;
}

const StorefrontReviewForm = ({ branchId, accent, productName }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
        body: JSON.stringify({
          action: 'submit_review',
          branch_id: branchId,
          phone_number: phoneNumber.trim(),
          rating: rating || null,
          comment,
          product_name: productName || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Error al enviar');
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
        <p className="text-sm font-medium text-foreground">¡Mensaje enviado!</p>
        <p className="text-xs text-muted-foreground">El negocio recibirá tu comentario.</p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-5">Háblanos de tus experiencias</p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Enviar mensaje
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-6 space-y-5 bg-card w-full max-w-md">
      {/* Privacy header */}
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tus mensajes son privados. Solo la administración del negocio los recibe — no son comentarios públicos. Úsalos para enviarnos quejas, sugerencias o consultas.
        </p>
      </div>

      {/* Product context */}
      {productName && (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Sobre el producto</label>
          <div className="h-10 px-4 rounded-full border border-border bg-muted/30 text-sm text-foreground flex items-center">
            {productName}
          </div>
        </div>
      )}

      {/* Phone number */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">
          <Phone className="h-3 w-3 inline mr-1" />
          Número de celular <span className="text-destructive">*</span>
        </label>
        <input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+53 5XXXXXXX"
          type="tel"
          className="w-full h-10 px-4 rounded-full border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Rating - optional */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Puntuación (opcional)</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(prev => prev === i ? 0 : i)}
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

      {/* Comment */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Comentario (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escríbenos tu queja, sugerencia o consulta"
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !phoneNumber.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar mensaje'}
      </button>
    </div>
  );
};

export default StorefrontReviewForm;
