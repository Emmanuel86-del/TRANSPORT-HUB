import { useState } from 'react';
import { Truck as TruckIcon, Mail, Lock, User, Shield, UserCog, Briefcase, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/types';

const roleOptions: { value: UserRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'employee', label: 'Employee', icon: <UserCog className="h-6 w-6" />, desc: 'Operational access only' },
  { value: 'manager', label: 'Manager', icon: <Briefcase className="h-6 w-6" />, desc: 'Operational + management access' },
  { value: 'corporate_admin', label: 'Corporate Admin', icon: <Shield className="h-6 w-6" />, desc: 'Full access to all modules' },
];

export function AuthPage() {
  const { signIn, signUp, authError, retry, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setLoading(false);
      }
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      if (!fullName.trim()) {
        setError('Please enter your full name');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role);
      if (error) {
        setError(error);
        setLoading(false);
      }
    }
  };

  const displayedError = error || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 mb-3">
            <TruckIcon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Suraj Ashok Limited</h1>
          <p className="text-sm text-slate-400 mt-1">Fleet Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Create Account
            </button>
          </div>

          {displayedError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-600">{displayedError}</p>
                  {authError && !error && (
                    <button
                      onClick={() => retry()}
                      disabled={authLoading}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-800"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${authLoading ? 'animate-spin' : ''}`} />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-9 pr-9"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="label">Account Type</label>
                <div className="space-y-2">
                  {roleOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className={`flex items-center gap-3 w-full rounded-xl border-2 p-3 transition-all text-left ${role === opt.value ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className={`shrink-0 ${role === opt.value ? 'text-blue-600' : 'text-slate-400'}`}>
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium block ${role === opt.value ? 'text-blue-700' : 'text-slate-600'}`}>{opt.label}</span>
                        <span className="text-xs text-slate-400">{opt.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'signin' && (
            <p className="mt-5 text-center text-xs text-slate-400">
              Don't have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(null); }} className="text-blue-600 hover:text-blue-700 font-medium">
                Create one
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p className="mt-5 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(null); }} className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
