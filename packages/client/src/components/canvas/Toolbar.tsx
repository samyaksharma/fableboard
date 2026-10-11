import { useCanvasStore, ToolType } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { PeopleMenu } from '@/components/session/PeopleMenu';
import { usePermissions } from '@/hooks/usePermissions';

const tools: { type: ToolType; label: string; icon: string }[] = [
  { type: 'select', label: 'Select', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 8-6 2-2 6z"/></svg>' },
  { type: 'draw', label: 'Draw', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>' },
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
  const toggleKanban = useUIStore((s) => s.toggleKanban);
  const kanbanOpen = useUIStore((s) => s.kanbanOpen);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
      <span className="font-bold text-lg text-slate-800 mr-4">Fableboard</span>

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

      {activeTool === 'draw' && (
        <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
          <label className="text-xs text-gray-500">Width</label>
          <input
            type="range"
            min={1}
            max={20}
            value={brushWidth}
            onChange={(e) => setBrushWidth(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-gray-500 w-4">{brushWidth}</span>
        </div>
      )}

      <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
        <label className="text-xs text-gray-500">Stroke</label>
        <div className="flex gap-0.5">
          {presetColors.slice(0, -1).map((color) => (
            <button
              key={`stroke-${color}`}
              onClick={() => {
                setStrokeColor(color);
                if (activeTool === 'draw') setBrushColor(color);
              }}
              className={`w-5 h-5 rounded-full border-2 ${
                (activeTool === 'draw' ? brushColor : strokeColor) === color
                  ? 'border-blue-500 scale-110'
                  : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {['rect', 'circle', 'triangle'].includes(activeTool) && (
        <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
          <label className="text-xs text-gray-500">Fill</label>
          <div className="flex gap-0.5">
            {presetColors.map((color) => (
              <button
                key={`fill-${color}`}
                onClick={() => setFillColor(color)}
                className={`w-5 h-5 rounded-full border-2 ${
                  fillColor === color
                    ? 'border-blue-500 scale-110'
                    : 'border-gray-300'
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
            ))}
          </div>
        </div>
      )}

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
  );
}
