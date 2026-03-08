import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Loader2, CheckCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const API_BASE = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const ReviewPage = () => {
  const { token } = useParams<{ token: string }>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!phoneNumber.trim() || !token) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY },
        body: JSON.stringify({
          action: 'submit_review',
          token,
          phone_number: phoneNumber.trim(),
          rating: rating || null,
          comment: comment.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSent(true);
      } else {
        setError(json.error || 'Error al enviar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">¡Gracias por tu mensaje!</h1>
          <p className="text-sm text-muted-foreground">El negocio recibirá tu comentario.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <Star className="h-8 w-8 mx-auto text-yellow-500" />
          <h1 className="text-xl font-bold text-foreground">¿Cómo fue tu experiencia?</h1>
        </div>

        {/* Privacy header */}
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tus mensajes son privados. Solo la administración del negocio los recibe — no son comentarios públicos.
          </p>
        </div>

        {/* Phone number */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            <Phone className="h-3 w-3 inline mr-1" />
            Número de celular <span className="text-destructive">*</span>
          </label>
          <input
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+53 5XXXXXXX"
            type="tel"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
          />
        </div>

        {/* Star rating - optional */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Puntuación (opcional)</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(prev => prev === s ? 0 : s)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    s <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <Textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Escríbenos tu queja, sugerencia o consulta (opcional)"
          rows={3}
          maxLength={500}
        />

        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={!phoneNumber.trim() || sending}
          className="w-full"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Enviar mensaje
        </Button>
      </div>
    </div>
  );
};

export default ReviewPage;
