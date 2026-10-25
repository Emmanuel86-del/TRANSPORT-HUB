import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { PortalConfig, SubAccount, PORTALS } from '@/lib/portals';
import { Truck, Lock, Mail, User, ArrowRight, AlertCircle } from 'lucide-react';

export function AuthPage({ portal }: { portal: PortalConfig }) {
  const { signIn, signUp, authError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [subAccount, setSubAccount] = useState<SubAccount>(portal.slug === 'master' ? 'mcl' : portal.slug);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, subAccount);
        if (error) {
          setLocalError(error);
        } else {
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setLocalError(error);
        }
      }
    } catch (err: any) {
      setLocalError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${portal.colorDark}, ${portal.color})` }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="p-8 text-center" style={{ background: portal.color }}>
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg mb-3 text-slate-900">
            <Truck className="h-8 w-8" style={{ color: portal.color }} />
          </div>
          <h1 className="text-xl font-bold text-white">{portal.fullName}</h1>
          <p className="text-xs text-white/80 mt-1">Fleet Management System</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setLocalError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setLocalError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {(localError || authError) && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{localError || authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="input pl-9 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9 text-sm"
                />
              </div>
            </div>

            {isSignUp && portal.slug === 'master' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Account Assignment</label>
                <select
                  value={subAccount}
                  onChange={e => setSubAccount(e.target.value as SubAccount)}
                  className="input text-sm"
                >
                  {(['mcl', 'tarmal', 'csl', 'mushroom'] as SubAccount[]).map(sa => (
                    <option key={sa} value={sa}>{PORTALS[sa].fullName}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-50"
              style={{ background: portal.color }}
            >
              {loading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
