import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  tableName: string;
  portalColor: string;
  subAccount: string;
  sampleColumns: string[];
  onSuccess: () => void;
}

export function BulkImportModal({
  open,
  onClose,
  tableName,
  portalColor,
  subAccount,
  sampleColumns,
  onSuccess,
}: BulkImportModalProps) {
  const { showToast } = useToast();
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);

  const downloadTemplate = () => {
    const header = sampleColumns.join(',') + '\n';
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${tableName}_bulk_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      showToast('Please paste CSV data or upload a file', 'error');
      return;
    }

    setLoading(true);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1);

      const records = rows.map(row => {
        const values = row.split(',').map(v => v.trim());
        const record: Record<string, any> = { sub_account: subAccount };
        headers.forEach((header, index) => {
          record[header] = values[index] !== undefined ? values[index] : null;
        });
        return record;
      });

      const { error } = await supabase.from(tableName).insert(records);
      if (error) throw error;

      showToast(`Successfully imported ${records.length} records!`, 'success');
      setCsvText('');
      onSuccess();
      onClose();
    } catch (err) {
      showToast('Import failed: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Bulk Import — ${tableName.toUpperCase()}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-lg">
          <div>
            <p className="text-xs font-semibold text-slate-700">Step 1: Download CSV Template</p>
            <p className="text-xs text-slate-500">Use our template to format your columns correctly.</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-100 transition-colors"
          >
            Download Template
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Step 2: Paste CSV Data or Spreadsheet Rows
          </label>
          <textarea
            rows={8}
            className="input font-mono text-xs"
            placeholder={sampleColumns.join(',') + '\nvalue1,value2,value3...'}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Tip: You can copy cells directly from Microsoft Excel or Google Sheets and paste them here.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm disabled:opacity-50"
            style={{ background: portalColor }}
          >
            <Upload className="h-4 w-4" />
            {loading ? 'Importing...' : 'Import Records'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
