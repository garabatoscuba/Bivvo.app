import { useState } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, Loader2, CheckCircle, MapPin } from 'lucide-react';
import { useStorefrontCart } from '@/contexts/StorefrontCartContext';

const API_BASE = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  open: boolean;
  onClose: () => void;
  accent: string;
  branchId: string;
  businessName: string;
  branchName: string;
  hasDelivery: boolean;
  branchPhone: string | null;
  currencySymbol: string;
}

const StorefrontCartDrawer = ({ open, onClose, accent, branchId, businessName, branchName, hasDelivery, branchPhone }: Props) => {
  const { items, updateQuantity, removeItem, clearCart, subtotal, totalItems } = useStorefrontCart();
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmitOrder = async () => {
    if (!name.trim() || !phone.trim()) return;
    if (hasDelivery && !address.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/functions/v1/public-storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY },
        body: JSON.stringify({
          action: 'submit_order',
          branch_id: branchId,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          delivery_address: hasDelivery ? address.trim() : null,
          notes: notes.trim() || null,
          items: items.map(i => ({
            product_id: i.product.id,
            product_name: i.product.name,
            quantity: i.quantity,
            unit_price: i.product.price,
            total: i.quantity * i.product.price,
          })),
          subtotal,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStep('success');
        clearCart();
      } else {
        setError(json.error || 'Error al enviar pedido');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    onClose();
    if (step === 'success') {
      setStep('cart');
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <h2 className="text-base font-semibold">
              {step === 'success' ? '¡Pedido enviado!' : step === 'checkout' ? 'Datos del pedido' : `Carrito (${totalItems})`}
            </h2>
          </div>
          <button onClick={handleClose} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'success' ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
              <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accent}20` }}>
                <CheckCircle className="h-8 w-8" style={{ color: accent }} />
              </div>
              <h3 className="text-lg font-semibold">¡Pedido recibido!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {businessName} ha recibido tu pedido. Te contactarán al {phone} para confirmar.
              </p>
              {branchPhone && (
                <p className="text-xs text-muted-foreground">
                  También puedes comunicarte al: <a href={`tel:${branchPhone}`} className="underline" style={{ color: accent }}>{branchPhone}</a>
                </p>
              )}
              <button
                onClick={handleClose}
                className="mt-4 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Cerrar
              </button>
            </div>
          ) : step === 'checkout' ? (
            <div className="p-5 space-y-4">
              {/* Order summary */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumen</h3>
                {items.map(item => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.quantity}x {item.product.name}</span>
                    <span className="font-medium">Bs {(item.quantity * item.product.price).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span>Bs {subtotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Customer info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tus datos</h3>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nombre completo *"
                  maxLength={100}
                  className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Teléfono / WhatsApp *"
                  maxLength={20}
                  className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                {hasDelivery && (
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                    <input
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Dirección de entrega *"
                      maxLength={200}
                      className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                )}
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notas adicionales (opcional)"
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">Tu carrito está vacío</p>
              <button
                onClick={handleClose}
                className="text-sm font-medium underline transition-colors hover:opacity-80"
                style={{ color: accent }}
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {items.map(item => (
                <div key={item.product.id} className="flex gap-3 p-3 rounded-xl border border-border bg-card">
                  {/* Image */}
                  {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{item.product.name}</h4>
                    <p className="text-xs text-muted-foreground">Bs {Number(item.product.price).toFixed(2)} c/u</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Bs {(item.quantity * item.product.price).toFixed(2)}</span>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'cart' && items.length > 0 && (
          <div className="border-t border-border p-5 space-y-3">
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>Bs {subtotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setStep('checkout')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {hasDelivery ? 'Pedir con delivery' : 'Realizar pedido'}
            </button>
            <button
              onClick={clearCart}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Vaciar carrito
            </button>
          </div>
        )}

        {step === 'checkout' && (
          <div className="border-t border-border p-5 space-y-3">
            <button
              onClick={handleSubmitOrder}
              disabled={sending || !name.trim() || !phone.trim() || (hasDelivery && !address.trim())}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar pedido'}
            </button>
            <button
              onClick={() => setStep('cart')}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver al carrito
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorefrontCartDrawer;
