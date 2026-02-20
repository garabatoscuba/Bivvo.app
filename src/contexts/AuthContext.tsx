import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  user_id: string;
  business_id: string | null;
  branch_id: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  plan_type: string;
  subscription_status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  deleted_at: string | null;
  deletion_scheduled_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchBranch: (branchId: string) => Promise<void>;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isSeller: boolean;
  isAccountant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      // Profile might not exist yet (e.g. deleted user re-registering)
      return data as Profile | null;
    } catch (err) {
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  const fetchRoles = async (userId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }
      return data.map(r => r.role);
    } catch (err) {
      console.error('Exception fetching roles:', err);
      return [];
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    // Listener for ONGOING auth changes (does NOT control initial loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Dispatch after callback to avoid Supabase deadlock
          setTimeout(async () => {
            if (!mountedRef.current) return;
            const [p, r] = await Promise.all([
              fetchProfile(newSession.user.id),
              fetchRoles(newSession.user.id),
            ]);
            if (!mountedRef.current) return;
            setProfile(p);
            setRoles(r);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    // INITIAL load — controls loading state
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          const [p, r] = await Promise.all([
            fetchProfile(existingSession.user.id),
            fetchRoles(existingSession.user.id),
          ]);
          if (!mountedRef.current) return;
          setProfile(p);
          setRoles(r);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });

    return { error: error || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const switchBranch = async (branchId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ branch_id: branchId })
      .eq('user_id', user.id);
    if (error) throw error;
    setProfile(prev => prev ? { ...prev, branch_id: branchId } : null);
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    loading,
    signIn,
    signUp,
    signOut,
    switchBranch,
    isSuperAdmin: roles.includes('super_admin'),
    isOwner: roles.includes('owner'),
    isManager: roles.includes('manager'),
    isSeller: roles.includes('seller'),
    isAccountant: roles.includes('accountant'),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
