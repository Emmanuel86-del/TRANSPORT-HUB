import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet } from 'lucide-react';

export function UniversalUploadModal() {
  const [uploading, setUploading] = useState(false);

  // ---> PASTE THE CODE HERE <---
  const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      alert('File is empty.');
      setUploading(false);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    let targetTable = '';

    // Detect table based on unique column headers
    if (headers.includes('plate_number') && headers.includes('capacity_kg')) {
      targetTable = 'vehicles';
    } else if (headers.includes('national_id') && headers.includes('license_number')) {
      targetTable = 'drivers';
    } else if (headers.includes('part_name') || headers.includes('quantity')) {
      targetTable = 'spare_parts';
    }

    if (!targetTable) {
      alert('Could not automatically determine the destination table based on column headers.');
      setUploading(false);
      return;
    }

    // Parse rows and insert into the detected table
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || null; });
      return obj;
    });

    const { error } = await supabase.from(targetTable).insert(rows);
    setUploading(false);
    
    if (error) alert('Import error: ' + error.message);
    else alert(`Successfully auto-imported data into ${targetTable}!`);
  };

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Smart Universal Data Importer</h3>
      <p className="text-sm text-slate-600">
        Upload any CSV file (Vehicles, Drivers, or Spare Parts). The application will automatically detect its type and populate the correct database table.
      </p>

      <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
        <FileSpreadsheet className="h-10 w-10 text-emerald-600 mb-2" />
        <span className="text-sm font-semibold text-slate-700">
          {uploading ? 'Processing & Routing File...' : 'Click to upload CSV file'}
        </span>
        <span className="text-xs text-slate-400 mt-1">Auto-detects columns and routes data</span>
        <input type="file" accept=".csv" className="hidden" onChange={handleUniversalUpload} disabled={uploading} />
      </label>
    </div>
  );
}
