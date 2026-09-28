import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, UserRole } from '@/types';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const loadingResolved = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    loadingResolved.current = true;
    setLoading(false);
  }, []);

  const startLoadingWithTimeout = useCallback(() => {
    loadingResolved.current = false;
    setLoading(true);
    setAuthError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!loadingResolved.current) {
        console.error('[Auth Error] Timeout: session/profile fetch exceeded 8 seconds');
        setAuthError('Taking longer than expected — please refresh and try again');
        setLoading(false);
      }
    }, TIMEOUT_MS);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[Auth Error] Profile fetch failed:', error.code, error.message, error.details);
    }
    setProfile(data as Profile | null);
  }, []);

  const initialize = useCallback(async () => {
    startLoadingWithTimeout();
    try {
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[Auth Error] getSession failed:', sessionError.code, sessionError.message);
        setAuthError('Failed to load session. Please try again.');
        finishLoading();
        return;
      }
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        await fetchProfile(existingSession.user.id);
      }
      finishLoading();
    } catch (err) {
      console.error('[Auth Error] Initialization exception:', err);
      setAuthError('Connection error — please check your network and try again.');
      finishLoading();
    }
  }, [fetchProfile, finishLoading, startLoadingWithTimeout]);

  useEffect(() => {
    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        (async () => {
          startLoadingWithTimeout();
          await fetchProfile(newSession.user.id);
          finishLoading();
        })();
      } else {
        setProfile(null);
        finishLoading();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [initialize, fetchProfile, startLoadingWithTimeout, finishLoading]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth Error] Sign in failed:', error.code, error.message);
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    if (error) {
      console.error('[Auth Error] Sign up failed:', error.code, error.message);
      return { error: error.message };
    }
    if (data.user) {
      await fetchProfile(data.user.id);
    }
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAuthError(null);
  }, []);

  const retry = useCallback(() => {
    setAuthError(null);
    initialize();
  }, [initialize]);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, authError, signIn, signUp, signOut, retry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
