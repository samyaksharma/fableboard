import type { CursorPosition } from '@fableboard/shared';

interface Props {
  cursors: Map<string, CursorPosition>;
}

export function RemoteCursors({ cursors }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.participantId}
          className="absolute transition-all duration-75"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
          >
            <path
              d="M0 0L16 12H6L3 20L0 0Z"
              fill={cursor.color}
            />
          </svg>
          <span
            className="absolute left-4 top-3 text-xs text-white px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}
