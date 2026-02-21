import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Loader2, CheckCircle, Star, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  branchId: string;
  accent: string;
  portalPath: string; // current portal URL path e.g. /tienda/biz/branch
}

const StorefrontAffiliateForm = ({ branchId, accent, portalPath }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [affiliationStatus, setAffiliationStatus] = useState<'none' | 'joined' | 'checking'>('checking');
  const [joining, setJoining] = useState(false);
  const [points, setPoints] = useState(0);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Check if already affiliated to this branch
        try {
          const res = await supabase.functions.invoke('affiliate-join', {
            body: { branch_id: branchId },
          });
          if (res.data?.success) {
            setPoints(res.data.affiliation?.points || 10);
            setAffiliationStatus('joined');
          } else {
            setAffiliationStatus('none');
          }
        } catch {
          setAffiliationStatus('none');
        }
      } else {
        setAffiliationStatus('none');
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes (user just logged in from redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // Auto-affiliate on sign in
        handleJoin(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, [branchId]);

  const handleJoin = async (token?: string) => {
    setJoining(true);
    try {
      const res = await supabase.functions.invoke('affiliate-join', {
        body: { branch_id: branchId },
      });
      if (res.data?.success) {
        setPoints(res.data.affiliation?.points || 10);
        setAffiliationStatus('joined');
      }
    } catch {
      // silent
    } finally {
      setJoining(false);
    }
  };

  const handleLoginRedirect = () => {
    // Save return info before navigating to auth
    sessionStorage.setItem('affiliate_redirect', portalPath);
    sessionStorage.setItem('affiliate_branch_id', branchId);
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border p-6 text-center bg-card">
        <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already affiliated
  if (affiliationStatus === 'joined') {
    return (
      <div className="rounded-2xl border border-border p-6 text-center space-y-3 bg-card">
        <CheckCircle className="h-10 w-10 mx-auto" style={{ color: accent }} />
        <p className="text-sm font-medium text-foreground">¡Ya eres miembro!</p>
        <p className="text-xs text-muted-foreground">
          Tienes <span className="font-semibold" style={{ color: accent }}>{points} puntos</span> acumulados.
        </p>
      </div>
    );
  }

  // Not logged in — show CTA to login/register
  if (!user) {
    return (
      <div className="rounded-2xl border border-border p-5 space-y-4 bg-card">
        <div className="text-center space-y-1">
          <Gift className="h-8 w-8 mx-auto" style={{ color: accent }} />
          <h3 className="text-sm font-semibold text-foreground">Programa de fidelización</h3>
          <p className="text-xs text-muted-foreground">Únete para acumular puntos y obtener beneficios exclusivos.</p>
        </div>
        <button
          onClick={handleLoginRedirect}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <LogIn className="h-4 w-4" />
          Únete y gana puntos
        </button>
      </div>
    );
  }

  // Logged in but not affiliated yet
  return (
    <div className="rounded-2xl border border-border p-5 space-y-4 bg-card">
      <div className="text-center space-y-1">
        <Gift className="h-8 w-8 mx-auto" style={{ color: accent }} />
        <h3 className="text-sm font-semibold text-foreground">¡Únete a esta tienda!</h3>
        <p className="text-xs text-muted-foreground">Afíliate para acumular puntos con tus compras aquí.</p>
      </div>
      <button
        onClick={() => handleJoin()}
        disabled={joining}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
        Afiliarme (+10 pts de bienvenida)
      </button>
    </div>
  );
};

export default StorefrontAffiliateForm;
