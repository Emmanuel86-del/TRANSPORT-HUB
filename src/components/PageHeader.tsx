import { ReactNode } from 'react';
import { Plus } from 'lucide-react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, icon, onAdd, addLabel = 'Add New', actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
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
