import { useState } from 'react';
import { useExport } from '@/hooks/useExport';
import { usePermissions } from '@/hooks/usePermissions';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const { exportJSON, exportPDF } = useExport();
  const { canExport } = usePermissions();

  if (!canExport) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
      >
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-50 min-w-32">
          <button
            onClick={() => {
              exportJSON();
              setOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => {
              exportPDF();
              setOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
          >
            Export PDF
          </button>
        </div>
      )}
    </div>
  );
}
