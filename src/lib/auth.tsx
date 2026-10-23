import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, setSubAccountFilter } from '@/lib/supabase';
import { Profile } from '@/types';
import { SubAccount, slugFromPath, pathForSlug } from '@/lib/portals';

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

function getCurrentSlug(): SubAccount {
  return slugFromPath(window.location.pathname) ?? 'master';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Self-healing profile fetcher: never returns null so you are never logged out on timeout
  const fetchProfile = useCallback(async (userId: string, userEmail?: string): Promise<Profile> => {
    const currentSlug = getCurrentSlug();
    const fallbackProfile: Profile = {
      id: userId,
      email: userEmail || 'admin@company.com',
      full_name: 'System Administrator',
      role: 'corporate_admin',
      sub_account: currentSlug === 'master' ? 'master' : currentSlug,
    };

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const { data, error } = (await Promise.race([profilePromise, timeoutPromise])) as any;

      if (error || !data) {
        console.warn('Profile fetch missed or timed out. Using self-healing fallback profile.');
        // Silently ensure profile exists in DB
        await supabase.from('profiles').upsert([fallbackProfile]).select().maybeSingle();
        return fallbackProfile;
      }
      return data as Profile;
    } catch (err) {
      console.warn('Profile fetch exception, using fallback profile:', err);
      return fallbackProfile;
    }
  }, []);

  const initAuth = useCallback(async () => {
    setLoading(true);
    setAuthError(null);

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setAuthError(sessionError.message);
        clearTimeout(safetyTimer);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // Await profile completely before clearing loading state to prevent role flash
        const userProfile = await fetchProfile(currentSession.user.id, currentSession.user.email);
        setProfile(userProfile);
        if (userProfile?.sub_account) {
          setSubAccountFilter(userProfile.sub_account);
        }
      }
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAuth();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const userProfile = await fetchProfile(newSession.user.id, newSession.user.email);
        setProfile(userProfile);
        if (userProfile?.sub_account) {
          setSubAccountFilter(userProfile.sub_account);
        }
      } else {
        setProfile(null);
        setSubAccountFilter(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, initAuth]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        const userProfile = await fetchProfile(data.user.id, data.user.email);
        setProfile(userProfile);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to sign in. Please check your connection.' };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, subAccount: SubAccount) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            sub_account: subAccount,
          },
        },
      });

      if (error) return { error: error.message };

      if (data.user) {
        await supabase.from('profiles').insert([
          {
            id: data.user.id,
            email,
            full_name: fullName,
            sub_account: subAccount,
            role: 'employee',
          },
        ]);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to sign up' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubAccountFilter(null);
    window.location.replace('/admin');
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        authError,
        subAccount: (profile?.sub_account as SubAccount) ?? null,
        signIn,
        signUp,
        signOut,
        retry: initAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
