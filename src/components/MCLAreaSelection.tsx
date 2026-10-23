import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { Truck as TruckIcon, ChevronRight, ArrowLeft } from 'lucide-react';
import { PortalConfig, MCL_AREAS, MCLArea } from '@/lib/portals';

type IconName = keyof typeof Icons;

export function MCLAreaSelection({
  portal,
  onAreaSelected,
}: {
  portal: PortalConfig;
  onAreaSelected: (area: MCLArea) => void;
}) {
  const [selectedArea, setSelectedArea] = useState<MCLArea | null>(null);

  useEffect(() => {
    if (selectedArea) {
      const timer = setTimeout(() => onAreaSelected(selectedArea), 100);
      return () => clearTimeout(timer);
    }
  }, [selectedArea, onAreaSelected]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 text-white shadow-md"
        style={{ background: `linear-gradient(90deg, ${portal.colorDark}, ${portal.color})` }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow">
            <TruckIcon className="h-6 w-6" style={{ color: portal.color }} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{portal.fullName}</h1>
            <p className="text-xs text-white/70">Select an area to continue</p>
          </div>
        </div>
      </header>

      {/* Area Cards */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Choose Your Area</h2>
        <p className="text-sm text-slate-500 mb-8">Select a work area to access its operations dashboard.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(Object.entries(MCL_AREAS) as [MCLArea, { name: string; color: string; icon: string }][]).map(([areaId, area]) => {
            const Icon = (Icons[area.icon as IconName] || Icons.MapPin) as Icons.LucideIcon;
            const isSelected = selectedArea === areaId;
            return (
              <button
                key={areaId}
                onClick={() => setSelectedArea(areaId)}
                className={`group relative overflow-hidden rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
                  isSelected ? 'border-transparent shadow-xl scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}
                style={isSelected ? { background: `linear-gradient(135deg, ${area.color}, ${area.color}dd)` } : undefined}
              >
                <div className="flex flex-col items-start gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.2)' : `${area.color}15`,
                    }}
                  >
                    <Icon
                      className="h-6 w-6 transition-colors"
                      style={{ color: isSelected ? '#fff' : area.color }}
                    />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold transition-colors"
                      style={{ color: isSelected ? '#fff' : '#1e293b' }}
                    >
                      {area.name}
                    </h3>
                    <p
                      className="text-xs mt-0.5 transition-colors"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#94a3b8' }}
                    >
                      MCL Operations
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium mt-1" style={{ color: isSelected ? '#fff' : area.color }}>
                    Enter
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MCLBreadcrumb({ area, onBack }: { area: MCLArea; onBack: () => void }) {
  const areaInfo = MCL_AREAS[area];
  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={onBack} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium">
        <ArrowLeft className="h-3.5 w-3.5" />
        MCL
      </button>
      <span className="text-slate-300">/</span>
      <span className="font-semibold text-slate-800">{areaInfo.name}</span>
    </div>
  );
}
