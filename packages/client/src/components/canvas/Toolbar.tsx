import { useCanvasStore, ToolType } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { PeopleMenu } from '@/components/session/PeopleMenu';
import { SessionMenu } from '@/components/session/SessionMenu';
import { historyControls, useHistoryState } from '@/services/historyControls';
import { usePermissions } from '@/hooks/usePermissions';

const tools: { type: ToolType; label: string; icon: string }[] = [
  { type: 'select', label: 'Select', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 8-6 2-2 6z"/></svg>' },
  { type: 'draw', label: 'Draw', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>' },
  { type: 'eraser', label: 'Eraser', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21h10"/><path d="M5.5 13.5l7-7a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L11 19H8l-2.5-2.5a2 2 0 010-3z"/></svg>' },
  { type: 'line', label: 'Line', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5"/></svg>' },
  { type: 'arrow', label: 'Arrow', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5"/><path d="M10 5h9v9"/></svg>' },
  { type: 'rect', label: 'Rectangle', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1"/></svg>' },
  { type: 'circle', label: 'Circle', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>' },
  { type: 'triangle', label: 'Triangle', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/></svg>' },
  { type: 'sticky_note', label: 'Sticky Note', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>' },
];

const presetColors = [
  '#1e293b',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
  'transparent',
];

export function Toolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const brushColor = useCanvasStore((s) => s.brushColor);
  const setBrushColor = useCanvasStore((s) => s.setBrushColor);
  const brushWidth = useCanvasStore((s) => s.brushWidth);
  const setBrushWidth = useCanvasStore((s) => s.setBrushWidth);
  const fillColor = useCanvasStore((s) => s.fillColor);
  const setFillColor = useCanvasStore((s) => s.setFillColor);
  const strokeColor = useCanvasStore((s) => s.strokeColor);
  const setStrokeColor = useCanvasStore((s) => s.setStrokeColor);
  const { canDraw } = usePermissions();
  const canUndo = useHistoryState((s) => s.canUndo);
  const canRedo = useHistoryState((s) => s.canRedo);
  const toggleKanban = useUIStore((s) => s.toggleKanban);
  const kanbanOpen = useUIStore((s) => s.kanbanOpen);

  const strokeSelected = activeTool === 'draw' ? brushColor : strokeColor;
  const isShapeTool = ['rect', 'circle', 'triangle'].includes(activeTool);
  const usesWidth = ['draw', 'line', 'arrow'].includes(activeTool);

  const swatch = (color: string, selected: boolean, onPick: () => void, key: string) => (
    <button
      key={key}
      onClick={onPick}
      aria-label={`Colour ${color}`}
      className={`w-5 h-5 rounded-full border-2 shrink-0 ${
        selected ? 'border-blue-500 scale-110' : 'border-gray-300'
      }`}
      style={{
        backgroundColor: color === 'transparent' ? 'white' : color,
        backgroundImage:
          color === 'transparent'
            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)'
            : undefined,
        backgroundSize: '6px 6px',
        backgroundPosition: '0 0, 3px 3px',
      }}
    />
  );

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex flex-nowrap items-center gap-2 px-4 py-2">
        <SessionMenu />

        {!canDraw && (
          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">View only</span>
        )}
        {canDraw && (
          <>
            <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
              {tools.map((tool) => (
                <button
                  key={tool.type}
                  title={tool.label}
                  onClick={() => setActiveTool(tool.type)}
                  className={`w-9 h-9 flex items-center justify-center rounded text-lg transition-colors ${
                    activeTool === tool.type
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  dangerouslySetInnerHTML={{ __html: tool.icon }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={() => historyControls.undo()}
                className="w-9 h-9 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>' }}
              />
              <button
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={() => historyControls.redo()}
                className="w-9 h-9 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/></svg>' }}
              />
            </div>
          </>
        )}

        <div className="flex-1" />

        <PeopleMenu />
        <ExportMenu />
        <button
          onClick={toggleKanban}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            kanbanOpen
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Kanban
        </button>
      </div>

      {canDraw && (
        <div className="flex flex-nowrap items-center gap-4 px-4 h-10 border-t border-gray-100 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500">Stroke</span>
            <div className="flex gap-1">
              {presetColors.slice(0, -1).map((color) =>
                swatch(
                  color,
                  strokeSelected === color,
                  () => {
                    setStrokeColor(color);
                    setBrushColor(color);
                  },
                  `stroke-${color}`,
                ),
              )}
            </div>
          </div>

          <div className={`flex items-center gap-2 shrink-0 ${isShapeTool ? '' : 'opacity-40'}`}>
            <span className="text-xs text-gray-500">Fill</span>
            <div className="flex gap-1">
              {presetColors.map((color) =>
                swatch(color, fillColor === color, () => setFillColor(color), `fill-${color}`),
              )}
            </div>
          </div>

          <div className={`flex items-center gap-2 shrink-0 ${usesWidth ? '' : 'opacity-40'}`}>
            <span className="text-xs text-gray-500">Width</span>
            <input
              type="range"
              min={1}
              max={20}
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              className="w-24"
              aria-label="Stroke width"
            />
            <span className="text-xs text-gray-500 w-4">{brushWidth}</span>
          </div>
        </div>
      )}
    </div>
  );
}
