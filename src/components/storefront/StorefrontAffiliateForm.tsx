import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Loader2, CheckCircle, Star, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  branchId: string;
  accent: string;
  portalPath: string;
}

const StorefrontAffiliateForm = ({ branchId, accent, portalPath }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [affiliationStatus, setAffiliationStatus] = useState<'none' | 'joined' | 'checking'>('checking');
  const [joining, setJoining] = useState(false);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
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
    sessionStorage.setItem('affiliate_redirect', portalPath);
    sessionStorage.setItem('affiliate_branch_id', branchId);
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="py-6 text-center">
        <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (affiliationStatus === 'joined') {
    return (
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4">
          Tu membresía
        </h3>
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 shrink-0" style={{ color: accent }} />
          <div>
            <p className="text-sm font-medium text-foreground">Miembro activo</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold" style={{ color: accent }}>{points} puntos</span> acumulados
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4 flex items-center gap-1.5">
        <Gift className="h-3.5 w-3.5" style={{ color: accent }} />
        Programa de fidelización
      </h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Únete para acumular puntos y obtener beneficios exclusivos.
      </p>
      <button
        onClick={user ? () => handleJoin() : handleLoginRedirect}
        disabled={joining}
        className="w-full flex items-center justify-center gap-2 rounded-full py-3 px-4 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        {joining ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : user ? (
          <>
            <Star className="h-4 w-4" />
            Afiliarme (+10 pts)
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Únete y gana puntos
          </>
        )}
      </button>
    </div>
  );
};

export default StorefrontAffiliateForm;
