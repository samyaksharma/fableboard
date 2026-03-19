import { useCanvasStore, ToolType } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { usePermissions } from '@/hooks/usePermissions';

const tools: { type: ToolType; label: string; icon: string }[] = [
  { type: 'select', label: 'Select', icon: '&#9995;' },
  { type: 'draw', label: 'Draw', icon: '&#9999;' },
  { type: 'rect', label: 'Rectangle', icon: '&#9632;' },
  { type: 'circle', label: 'Circle', icon: '&#9679;' },
  { type: 'triangle', label: 'Triangle', icon: '&#9650;' },
  { type: 'sticky_note', label: 'Sticky Note', icon: '&#128221;' },
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
  const toggleKanban = useUIStore((s) => s.toggleKanban);
  const kanbanOpen = useUIStore((s) => s.kanbanOpen);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
      {/* Logo */}
      <span className="font-bold text-lg text-slate-800 mr-4">Fableboard</span>

      {/* Tool buttons */}
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

      {/* Brush width (show when drawing) */}
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

      {/* Stroke color */}
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

      {/* Fill color (for shapes) */}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export */}
      <ExportMenu />

      {/* Kanban toggle */}
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
