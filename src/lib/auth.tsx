import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, setSubAccountFilter } from '@/lib/supabase';
import { Profile } from '@/types';
import { SubAccount, slugFromPath, portalLabel, pathForSlug } from '@/lib/portals';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  subAccount: SubAccount | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, subAccount: SubAccount) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const TIMEOUT_MS = 8000;

function getCurrentSlug(): SubAccount | null {
  return slugFromPath(window.location.pathname);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [subAccount, setSubAccount] = useState<SubAccount | null>(getCurrentSlug());
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
    return data as Profile | null;
  }, []);

  const validateAndEnforcePortal = useCallback(async (fetchedProfile: Profile | null): Promise<string | null> => {
    if (!fetchedProfile) return null;
    const portalSlug = getCurrentSlug();
    if (!portalSlug) return null;

    const userSubAccount = fetchedProfile.sub_account || 'master';

    if (portalSlug === 'master') {
      if (userSubAccount !== 'master') {
        await supabase.auth.signOut();
        setProfile(null);
        const correctPath = pathForSlug(userSubAccount as SubAccount);
        return `This account belongs to ${portalLabel(userSubAccount)}. Log in at ${correctPath}`;
      }
      return null;
    }

    if (userSubAccount === 'master') {
      window.location.replace('/admin');
      return null;
    }

    if (userSubAccount !== portalSlug) {
      await supabase.auth.signOut();
      setProfile(null);
      const correctPath = pathForSlug(userSubAccount as SubAccount);
      return `This account belongs to ${portalLabel(userSubAccount)}. Log in at ${correctPath}`;
    }

    return null;
  }, []);

  const initialize = useCallback(async () => {
    startLoadingWithTimeout();
    const slug = getCurrentSlug();
    setSubAccount(slug);
    setSubAccountFilter(slug);
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
        const fetchedProfile = await fetchProfile(existingSession.user.id);
        const portalError = await validateAndEnforcePortal(fetchedProfile);
        if (portalError) {
          setAuthError(portalError);
        } else if (fetchedProfile) {
          setSubAccountFilter(fetchedProfile.sub_account as SubAccount);
        }
      }
      finishLoading();
    } catch (err) {
      console.error('[Auth Error] Initialization exception:', err);
      setAuthError('Connection error — please check your network and try again.');
      finishLoading();
    }
  }, [fetchProfile, finishLoading, startLoadingWithTimeout, validateAndEnforcePortal]);

  useEffect(() => {
    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        (async () => {
          startLoadingWithTimeout();
          const fetchedProfile = await fetchProfile(newSession.user.id);
          const portalError = await validateAndEnforcePortal(fetchedProfile);
          if (portalError) {
            setAuthError(portalError);
          } else if (fetchedProfile) {
            setSubAccountFilter(fetchedProfile.sub_account as SubAccount);
          }
          finishLoading();
        })();
      } else {
        setProfile(null);
        setSubAccountFilter(getCurrentSlug());
        finishLoading();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [initialize, fetchProfile, startLoadingWithTimeout, finishLoading, validateAndEnforcePortal]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth Error] Sign in failed:', error.code, error.message);
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, sub: SubAccount) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'employee', sub_account: sub },
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
    setSubAccountFilter(getCurrentSlug());
  }, []);

  const retry = useCallback(() => {
    setAuthError(null);
    initialize();
  }, [initialize]);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, authError, subAccount, signIn, signUp, signOut, retry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
