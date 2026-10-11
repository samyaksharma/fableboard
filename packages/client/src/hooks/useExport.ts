import { useCallback } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useKanbanStore } from '@/stores/kanbanStore';
import { KANBAN_COLUMN_ORDER, KANBAN_COLUMN_LABELS } from '@fableboard/shared';

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

    pdf.addPage([captured.width, captured.height], captured.width > captured.height ? 'landscape' : 'portrait');
    const pageW = captured.width;
    const colW = pageW / KANBAN_COLUMN_ORDER.length;
    pdf.setFontSize(20);
    pdf.text(`${session?.title ?? 'Fableboard'} - Kanban`, 24, 36);
    const allCards = Object.values(cards).sort((a, b) => a.order - b.order);
    KANBAN_COLUMN_ORDER.forEach((col, i) => {
      const x = 24 + i * colW;
      const inCol = allCards.filter((c) => c.column === col);
      pdf.setFontSize(14);
      pdf.text(`${KANBAN_COLUMN_LABELS[col]} (${inCol.length})`, x, 72);
      let y = 96;
      inCol.forEach((c) => {
        pdf.setFontSize(11);
        const lines = pdf.splitTextToSize(c.title, colW - 40) as string[];
        pdf.text(lines, x, y);
        y += lines.length * 14;
        if (c.description) {
          pdf.setFontSize(9);
          const d = pdf.splitTextToSize(c.description, colW - 40) as string[];
          pdf.text(d, x, y);
          y += d.length * 11;
        }
        if (c.assignee) {
          pdf.setFontSize(9);
          pdf.text(`Assignee: ${c.assignee}`, x, y);
          y += 11;
        }
        y += 12;
      });
    });
    pdf.save(`fableboard-${session?.id ?? 'export'}.pdf`);
  }, [session, cards]);

  return { exportJSON, exportPDF };
}
