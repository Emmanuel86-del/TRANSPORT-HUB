import { useEffect, useState, useCallback } from 'react';
import { Users as UsersIcon, Search, Shield, Briefcase, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Profile, UserRole } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { portalLabel } from '@/lib/portals';

const roleBadge = (role: UserRole) => {
  switch (role) {
    case 'corporate_admin': return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"><Shield className="h-3 w-3" /> Corporate Admin</span>;
    case 'manager': return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"><Briefcase className="h-3 w-3" /> Manager</span>;
    default: return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"><UserCog className="h-3 w-3" /> Employee</span>;
  }
};

const roleIcon = (role: UserRole) => {
  switch (role) {
    case 'corporate_admin': return <Shield className="h-5 w-5 text-blue-500" />;
    case 'manager': return <Briefcase className="h-5 w-5 text-emerald-500" />;
    default: return <UserCog className="h-5 w-5 text-slate-400" />;
  }
};

export function Users() {
  const { profile: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Users] Failed to load profiles:', error);
    }
    setProfiles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (id: string, newRole: UserRole) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id);
    if (error) {
      console.error('[Users] Failed to update role:', error);
    }
    setUpdatingId(null);
    load();
  };

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
  });

  const counts = {
    corporate_admin: profiles.filter(p => p.role === 'corporate_admin').length,
    manager: profiles.filter(p => p.role === 'manager').length,
    employee: profiles.filter(p => p.role === 'employee').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Users" subtitle="Manage user accounts and roles" icon={<UsersIcon className="h-6 w-6" />} />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <p className="text-xs text-slate-400">Corporate Admins</p>
          </div>
          <p className="text-lg font-bold text-slate-700 mt-1">{counts.corporate_admin}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-500" />
            <p className="text-xs text-slate-400">Managers</p>
          </div>
          <p className="text-lg font-bold text-slate-700 mt-1">{counts.manager}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-slate-400" />
            <p className="text-xs text-slate-400">Employees</p>
          </div>
          <p className="text-lg font-bold text-slate-700 mt-1">{counts.employee}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="input pl-9" placeholder="Search by name, email, or role..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading users..." />
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<UsersIcon className="h-8 w-8" />} title="No users found" message="No user profiles match your search." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Sub-Account</th>
                <th>Current Role</th>
                <th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                        {roleIcon(p.role)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{p.full_name || 'Unnamed'}</p>
                        {currentUser?.id === p.id && <span className="text-xs text-blue-500">You</span>}
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-600 text-sm">{p.email}</td>
                  <td className="text-slate-600 text-sm capitalize">{portalLabel(p.sub_account)}</td>
                  <td>{roleBadge(p.role)}</td>
                  <td>
                    <select
                      className="input text-sm py-1.5 px-3 w-auto"
                      value={p.role}
                      disabled={updatingId === p.id || currentUser?.id === p.id}
                      onChange={e => updateRole(p.id, e.target.value as UserRole)}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="corporate_admin">Corporate Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
