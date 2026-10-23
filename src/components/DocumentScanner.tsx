import { useState, useRef, useCallback } from 'react';
import { ScanLine, FileUp, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

export interface ScannedDocumentFields {
  container_no: string | null;
  size: string | null;
  shipping_line: string | null;
  agent_name: string | null;
  consignee: string | null;
  bl_no: string | null;
  vessel_voyage: string | null;
  eta: string | null;
  destination: string | null;
  detention_validity: string | null;
  release_date: string | null;
}

interface DocumentScannerProps {
  onScanComplete: (fields: ScannedDocumentFields) => void;
  buttonLabel?: string;
  buttonClassName?: string;
}

export function DocumentScanner({
  onScanComplete,
  buttonLabel = 'Scan Document',
  buttonClassName = '',
}: DocumentScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setScanning(true);
    setError(null);
    setSuccess(false);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          mimeType: file.type || 'application/pdf',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Scan request failed' }));
        throw new Error(errData.error || `Scan failed (${response.status})`);
      }

      const fields = await response.json() as ScannedDocumentFields;
      setSuccess(true);
      onScanComplete(fields);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan document';
      setError(message);
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onScanComplete]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (scanning) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
        <div>
          <p className="text-sm font-medium text-blue-900">Reading document with Google Document AI...</p>
          <p className="text-xs text-blue-600">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${buttonClassName || 'btn-secondary'}`}
        >
          {success ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <ScanLine className="h-4 w-4" />}
          {success ? 'Fields Extracted' : buttonLabel}
        </button>
        {success && (
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Form auto-filled — review and edit as needed
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Document scan failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <p className="text-xs text-red-500 mt-1">You can still fill in the form manually below.</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/jpg,image/tiff"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
