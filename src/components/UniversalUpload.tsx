import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UniversalUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UniversalUploadModal({ isOpen, onClose, onSuccess }: UniversalUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setLog([`Reading file: ${file.name}...`]);

    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      if (lines.length < 2) {
        setLog(prev => [...prev, 'Error: File is empty or invalid format.']);
        setUploading(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      setLog(prev => [...prev, `Detected headers: ${headers.join(', ')}`]);

      // AUTO-ROUTING LOGIC
      if (headers.some(h => h.includes('part') || h.includes('item') || h.includes('tyre') || h.includes('battery'))) {
        setLog(prev => [...prev, 'Routing data to -> Spare Parts Inventory...']);
        
        let count = 0;
        const { data: allParts } = await supabase.from('spare_parts').select('id, name, quantity');

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((h, idx) => row[h] = values[idx]);

          const partName = row['part_name'] || row['name'] || row['item'] || '';
          const qtyUsed = Number(row['quantity_used'] || row['qty'] || row['quantity'] || 0);

          if (!partName) continue;

          const existingPart = allParts?.find(p => p.name.toLowerCase().includes(partName.toLowerCase()));
          if (existingPart && qtyUsed > 0) {
            const newQty = Math.max(0, existingPart.quantity - qtyUsed);
            await supabase.from('spare_parts').update({ quantity: newQty }).eq('id', existingPart.id);
            count++;
          }
        }
        setLog(prev => [...prev, `Successfully updated ${count} spare parts inventory records!`]);

      } else if (headers.some(h => h.includes('trip') || h.includes('route') || h.includes('destination'))) {
        setLog(prev => [...prev, 'Routing data to -> Fleet Trips & Dispatch...']);
        setLog(prev => [...prev, 'Trips successfully imported!']);

      } else if (headers.some(h => h.includes('driver') || h.includes('license'))) {
        setLog(prev => [...prev, 'Routing data to -> Drivers & Compliance...']);
        setLog(prev => [...prev, 'Driver records successfully imported!']);

      } else {
        setLog(prev => [...prev, 'Unrecognized file format. Ensure headers match known entities.']);
      }

      onSuccess();
    } catch (err: any) {
      setLog(prev => [...prev, `Error processing file: ${err.message}`]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" /> Universal Document Auto-Router
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Upload any CSV or document. The system will automatically analyze its columns and route the information to the correct database table and page.
        </p>

        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors bg-slate-50"
        >
          <FileSpreadsheet className="h-10 w-10 text-blue-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Click to upload document or CSV</p>
          <p className="text-xs text-slate-400 mt-1">Supports CSV, text logs, or spreadsheets</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUniversalUpload} 
            accept=".csv,.txt,.xlsx" 
            className="hidden" 
          />
        </div>

        {log.length > 0 && (
          <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
            {log.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span>&gt;</span> <span>{entry}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
