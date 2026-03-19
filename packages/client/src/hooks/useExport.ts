import { useCallback } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useKanbanStore } from '@/stores/kanbanStore';

export function useExport() {
  const session = useSessionStore((s) => s.session);
  const elements = useCanvasStore((s) => s.elements);
  const cards = useKanbanStore((s) => s.cards);

  const exportJSON = useCallback(() => {
    const data = {
      session,
      elements: Object.values(elements),
      cards: Object.values(cards),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fableboard-${session?.id ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session, elements, cards]);

  const exportPDF = useCallback(async () => {
    const canvasEl = document.querySelector('canvas');
    if (!canvasEl) return;

    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');

    const captured = await html2canvas(canvasEl, { useCORS: true });
    const imgData = captured.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: captured.width > captured.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [captured.width, captured.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, captured.width, captured.height);
    pdf.save(`fableboard-${session?.id ?? 'export'}.pdf`);
  }, [session]);

  return { exportJSON, exportPDF };
}
