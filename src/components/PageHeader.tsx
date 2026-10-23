import { ReactNode } from 'react';
import { Plus, Download } from 'lucide-react';
import { useToast } from '@/components/Toast';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconColor?: string;
  onAdd?: () => void;
  addLabel?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, icon, iconColor, onAdd, addLabel = 'Add New', actions }: PageHeaderProps) {
  const { showToast } = useToast();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: iconColor ?? '#2563EB' }}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={() => showToast('Template download coming soon', 'info')}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download Templates</span>
        </button>
        {onAdd && (
          <button onClick={onAdd} className="btn-primary">
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
