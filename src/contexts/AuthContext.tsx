import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';

interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: 'inactive' | 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  isLoading: boolean;
  subscriptionChecked: boolean;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      } else {
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, full_name: null, avatar_url: null })
          .select()
          .single();

        if (!insertError && newProfile) {
          setProfile(newProfile);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchSubscription = async (forceRefresh = false) => {
    try {
      // If already checked and not forcing, skip (use cached value)
      if (subscriptionChecked && !forceRefresh) {
        return;
      }

      // Ensure we have a valid session before calling the function
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        console.log('No valid session for subscription check');
        setSubscriptionChecked(true);
        return;
      }

      // Add timeout to prevent infinite blocking
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const { data, error } = await supabase.functions.invoke('get-subscription');

      clearTimeout(timeout);

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscriptionChecked(true);
        return;
      }

      if (data) {
        setSubscription(data.subscription);
        setIsAdmin(data.isAdmin);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setSubscriptionChecked(true);
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      setSubscriptionChecked(false);
      await fetchSubscription(true);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        return { error: new Error(error.message) };
      }

      // Refresh profile after update
      await fetchProfile(user.id);
      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message) };
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch profile in background
          fetchProfile(session.user.id);
          // Fetch subscription - this will set subscriptionChecked when done
          fetchSubscription();
        } else {
          // No user, mark subscription as checked
          setSubscriptionChecked(true);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setSubscriptionChecked(true);
      } finally {
        // Always set loading to false after checking session
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes (SIGNED_IN, SIGNED_OUT, etc.)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        // Skip INITIAL_SESSION as it's handled by getSession above
        if (event === 'INITIAL_SESSION') return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user && event === 'SIGNED_IN') {
          // Only block UI on fresh sign-in
          setSubscriptionChecked(false);
          fetchProfile(session.user.id);
          // Aguarda 500ms para garantir que o token está disponível
          // antes de chamar a Edge Function (evita race condition 401)
          setTimeout(() => {
            if (isMounted) fetchSubscription(true);
          }, 500);
        } else if (session?.user && event === 'TOKEN_REFRESHED') {
          // Token refresh: update in background without blocking UI
          fetchSubscription(true);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setSubscription(null);
          setIsAdmin(false);
          setSubscriptionChecked(true);
        }

        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authSubscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await logAuditEvent({
      action: 'logout',
      level: 'info',
      details: 'Logout realizado',
    });
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
    setIsAdmin(false);
    setSubscriptionChecked(true);
  };

  const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'trialing' || isAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      subscription,
      isAdmin,
      isLoading,
      subscriptionChecked,
      isAuthenticated: !!user,
      hasActiveSubscription,
      signIn,
      signUp,
      signOut,
      refreshSubscription,
      refreshProfile,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
