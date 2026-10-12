import { useEffect } from 'react';
import { Point, util, type Canvas, type FabricObject } from 'fabric';
import { useCanvasStore } from '@/stores/canvasStore';

const TOLERANCE = 8;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return p.distanceFrom(a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return p.distanceFrom(new Point(a.x + t * dx, a.y + t * dy));
}

// Hit-test a freehand path by distance to the line itself. Fabric's per-pixel test cannot see
// a perfectly straight stroke (its bounding box has zero height), and its bounding-box test
// would erase a diagonal stroke from anywhere inside its box.
function hitsPath(obj: any, point: Point): boolean {
  const commands: any[][] | undefined = obj.path;
  if (!commands?.length) return false;
  const matrix = obj.calcTransformMatrix();
  const offset: Point = obj.pathOffset;
  const points = commands
    .filter((c) => c.length >= 3)
    .map((c) =>
      util.transformPoint(new Point(c[c.length - 2] - offset.x, c[c.length - 1] - offset.y), matrix),
    );
  const radius = (obj.strokeWidth ?? 1) / 2 + TOLERANCE;
  if (points.length === 1) return points[0].distanceFrom(point) <= radius;
  return points.some((pt, i) => i > 0 && distanceToSegment(point, points[i - 1], pt) <= radius);
}

function hits(obj: FabricObject, point: Point): boolean {
  return obj.type === 'path' ? hitsPath(obj, point) : obj.containsPoint(point);
}

/**
 * Object eraser: while the eraser tool is active, dragging over a stroke or shape removes it
 * (all parts of a sticky note go together). Removal flows through the normal object:removed
 * sync, so other clients delete it too.
 */
export function useEraser(fabricRef: React.RefObject<Canvas | null>, enabled: boolean) {
  const activeTool = useCanvasStore((s) => s.activeTool);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !enabled || activeTool !== 'eraser') return;

    let erasing = false;
    const previous = {
      selection: canvas.selection,
      cursor: canvas.defaultCursor,
      hover: canvas.hoverCursor,
    };
    canvas.discardActiveObject();
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
    canvas.renderAll();

    const eraseAt = (e: { e: Event }) => {
      const point = canvas.getScenePoint(e.e as any);
      const ids = new Set<string>();
      const loose: FabricObject[] = [];
      for (const obj of canvas.getObjects()) {
        if (!hits(obj, point)) continue;
        const id = (obj as any).__elementId as string | undefined;
        if (id) ids.add(id);
        else loose.push(obj);
      }
      if (!ids.size && !loose.length) return;
      canvas
        .getObjects()
        .filter((o) => loose.includes(o) || ids.has((o as any).__elementId))
        .forEach((o) => canvas.remove(o));
      canvas.renderAll();
    };
    const down = (e: { e: Event }) => {
      erasing = true;
      eraseAt(e);
    };
    const move = (e: { e: Event }) => erasing && eraseAt(e);
    const up = () => {
      erasing = false;
    };

    canvas.on('mouse:down', down as any);
    canvas.on('mouse:move', move as any);
    canvas.on('mouse:up', up);
    return () => {
      canvas.off('mouse:down', down as any);
      canvas.off('mouse:move', move as any);
      canvas.off('mouse:up', up);
      canvas.selection = previous.selection;
      canvas.defaultCursor = previous.cursor;
      canvas.hoverCursor = previous.hover;
    };
  }, [fabricRef, enabled, activeTool]);
}
