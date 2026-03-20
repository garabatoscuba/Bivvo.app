import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const handleCallback = async () => {
      try {
        // Check for tokens in the URL hash (OAuth redirect)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          // Set session from URL tokens
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          navigate("/", { replace: true });
          return;
        }

        // Check for code exchange flow
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          navigate("/", { replace: true });
          return;
        }

        // Fallback: check if session already exists
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate("/", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        navigate("/auth", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
};

export default AuthCallback;
