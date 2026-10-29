import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, setSubAccountFilter } from '@/lib/supabase';
import { Profile } from '@/types';
import { SubAccount, slugFromPath } from '@/lib/portals';

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
  return slugFromPath(window.location.pathname) ?? 'mcl';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Keep track of current user ID to prevent redundant profile re-fetches on tab switches
  const currentUserIdRef = useRef<string | null>(null);

  // Profile fetcher from Supabase with resilient timeout handling
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
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
        return null;
      }
      return data as Profile;
    } catch (err) {
      return null;
    }
  }, []);

  const initAuth = useCallback(async () => {
    setLoading(true);
    setAuthError(null);

    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setAuthError(sessionError.message);
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        currentUserIdRef.current = currentSession.user.id;
        const userProfile = await fetchProfile(currentSession.user.id);
        if (userProfile) {
          setProfile(userProfile);
          if (userProfile.sub_account) {
            setSubAccountFilter(userProfile.sub_account);
          }
        }
      } else {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setSubAccountFilter(null);
      }
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAuth();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // Ignore TOKEN_REFRESHED or duplicate events if the user ID hasn't actually changed
      // This prevents tab-switching focus triggers from wiping or resetting your React state.
      if (event === 'TOKEN_REFRESHED' && newSession?.user?.id === currentUserIdRef.current) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        currentUserIdRef.current = newSession.user.id;
        // Only fetch profile if we don't already have it loaded for this user
        setProfile(prevProfile => {
          if (prevProfile && prevProfile.id === newSession.user.id) {
            return prevProfile;
          }
          return prevProfile;
        });

        const userProfile = await fetchProfile(newSession.user.id);
        if (userProfile) {
          setProfile(userProfile);
          if (userProfile.sub_account) {
            setSubAccountFilter(userProfile.sub_account);
          }
        }
      } else {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setSubAccountFilter(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, initAuth]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        currentUserIdRef.current = data.user.id;
        const userProfile = await fetchProfile(data.user.id);
        setProfile(userProfile);
        if (userProfile?.sub_account) {
          setSubAccountFilter(userProfile.sub_account);
        }
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
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubAccountFilter(null);
    window.location.replace('/mcl');
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        authError,
        subAccount: (profile?.sub_account as SubAccount) ?? getCurrentSlug(),
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
