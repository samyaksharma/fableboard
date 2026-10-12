import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { Canvas, FabricObject } from 'fabric';
import { SocketEvents, nowISO, type CanvasElement } from '@fableboard/shared';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';
import { historyControls, useHistoryState } from '@/services/historyControls';
import {
  EXTRA_PROPS,
  addElementToCanvas,
  buildMovePayload,
  objectsFor,
  settable,
} from './useCanvasSync';

type ObjData = Record<string, any>;
interface Snapshot {
  element: CanvasElement;
  objects: ObjData[];
}
type Action =
  | { kind: 'add'; id: string; snapshot: Snapshot }
  | { kind: 'remove'; id: string; snapshot: Snapshot }
  | { kind: 'modify'; id: string; before: ObjData[]; after: ObjData[] };

const LIMIT = 100;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Per-user undo/redo. Only this user's own changes are recorded, and undoing replays them
 * through the normal add/move/delete events, so everyone else sees the result and the server
 * needs no special handling. Sticky-note text is excluded: it is merged by OT, not replayed.
 */
export function useHistory(fabricRef: React.RefObject<Canvas | null>, socket: Socket | null, enabled: boolean) {
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !socket || !session || !enabled) return;

    const undoStack: Action[] = [];
    const redoStack: Action[] = [];
    const known = new Map<string, CanvasElement>();
    const pendingAdds = new Set<FabricObject>();
    const pendingRemovals = new Map<string, ObjData[]>();
    const pendingBefore = new Map<string, ObjData[]>();
    let flushQueued = false;

    const unsubscribe = useCanvasStore.subscribe((state) => {
      Object.values(state.elements).forEach((el) => known.set(el.id, el));
    });
    Object.values(useCanvasStore.getState().elements).forEach((el) => known.set(el.id, el));

    const publish = () =>
      useHistoryState.setState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });

    const push = (action: Action) => {
      undoStack.push(action);
      if (undoStack.length > LIMIT) undoStack.shift();
      redoStack.length = 0;
      publish();
    };

    const serialize = (id: string): ObjData[] =>
      objectsFor(canvas, id).map((o) => (o.toObject as any)(EXTRA_PROPS));

    // Rebuild the full element record from on-canvas objects plus the last known store record.
    const elementFrom = (id: string, objects: ObjData[]): CanvasElement | null => {
      const base = known.get(id);
      if (!base || !objects.length) return null;
      const bg = objects.find((o) => o.__stickyRole === 'bg');
      const text = objects.find((o) => o.__stickyRole === 'text');
      const main = bg ?? objects[0];
      return {
        ...base,
        position: { x: main.left ?? 0, y: main.top ?? 0 },
        fabricData: base.type === 'sticky_note' ? { bg, text } : main,
        updatedAt: nowISO(),
      };
    };

    const snapshotOf = (id: string, fallback?: Snapshot): Snapshot | null => {
      const objects = serialize(id);
      const element = elementFrom(id, objects);
      return element ? { element, objects } : (fallback ?? null);
    };

    // Freehand paths get their element id just after being added, so ids are read at flush time.
    const flush = () => {
      flushQueued = false;
      const ids = new Set<string>();
      pendingAdds.forEach((o) => {
        const id = (o as any).__elementId;
        if (id) ids.add(id);
      });
      pendingAdds.clear();
      ids.forEach((id) => {
        const snap = snapshotOf(id);
        if (snap) push({ kind: 'add', id, snapshot: snap });
      });
      pendingRemovals.forEach((objects, id) => {
        const element = elementFrom(id, objects);
        if (element) push({ kind: 'remove', id, snapshot: { element, objects } });
      });
      pendingRemovals.clear();
    };
    const queueFlush = () => {
      if (flushQueued) return;
      flushQueued = true;
      queueMicrotask(flush);
    };

    const onAdded = (e: { target?: FabricObject }) => {
      const obj = e.target as any;
      if (!obj || obj.__skipEmit || historyControls.isSuspended()) return;
      pendingAdds.add(obj);
      queueFlush();
    };

    const onRemoved = (e: { target?: FabricObject }) => {
      const obj = e.target as any;
      if (!obj || obj.__skipEmit || historyControls.isSuspended() || !obj.__elementId) return;
      const list = pendingRemovals.get(obj.__elementId) ?? [];
      list.push((obj.toObject as any)(EXTRA_PROPS));
      pendingRemovals.set(obj.__elementId, list);
      queueFlush();
    };

    const onBeforeTransform = (e: { transform?: { target?: FabricObject } }) => {
      const obj = e.transform?.target as any;
      const id = obj?.__elementId;
      if (!id || obj.__stickyRole === 'text' || pendingBefore.has(id)) return;
      pendingBefore.set(id, serialize(id));
    };

    const onModified = (e: { target?: FabricObject }) => {
      const obj = e.target as any;
      const id = obj?.__elementId;
      if (!id || obj.__skipEmit || obj.__stickyRole === 'text' || historyControls.isSuspended()) return;
      const before = pendingBefore.get(id);
      pendingBefore.delete(id);
      const after = serialize(id);
      if (before && !sameJson(before, after)) push({ kind: 'modify', id, before, after });
    };

    const present = (id: string) => objectsFor(canvas, id).length > 0;

    const removeNow = (id: string) =>
      historyControls.suspend(() => {
        objectsFor(canvas, id).forEach((o) => canvas.remove(o));
        canvas.renderAll();
      });

    const reAdd = async (snap: Snapshot) => {
      const element = { ...snap.element, updatedAt: nowISO() };
      useCanvasStore.getState().addElement(element);
      await addElementToCanvas(canvas, element);
      socket.emit(SocketEvents.ADD_ELEMENT, { element });
    };

    const applyState = (id: string, states: ObjData[]) => {
      objectsFor(canvas, id).forEach((obj) => {
        const role = (obj as any).__stickyRole;
        const data = states.find((s) => s.__stickyRole === role) ?? states[0];
        if (!data) return;
        // Text content belongs to OT; restoring geometry must not roll it back.
        const { text: _text, ...rest } = data;
        (obj as any).__skipEmit = true;
        obj.set(settable(role === 'text' ? rest : data) as any);
        obj.setCoords();
        delete (obj as any).__skipEmit;
      });
      const payload = buildMovePayload(canvas, session.id, id);
      if (payload) {
        socket.emit(SocketEvents.MOVE_ELEMENT, payload);
        useCanvasStore.getState().updateElement(id, { position: payload.position, updatedAt: payload.updatedAt });
      }
      canvas.renderAll();
    };

    const run = async (from: Action[], to: Action[], direction: 'undo' | 'redo') => {
      const action = from.pop();
      if (!action) return;
      let ok = true;
      if (action.kind === 'modify') {
        if (present(action.id)) applyState(action.id, direction === 'undo' ? action.before : action.after);
        else ok = false;
      } else {
        const wantPresent = (action.kind === 'add') === (direction === 'redo');
        if (wantPresent) {
          if (!present(action.id)) await reAdd(action.snapshot);
        } else if (present(action.id)) {
          action.snapshot = snapshotOf(action.id, action.snapshot) ?? action.snapshot;
          removeNow(action.id);
        }
      }
      if (ok) to.push(action);
      publish();
    };

    const undo = () => void run(undoStack, redoStack, 'undo');
    const redo = () => void run(redoStack, undoStack, 'redo');
    const clear = () => {
      undoStack.length = 0;
      redoStack.length = 0;
      known.clear();
      publish();
    };

    canvas.on('object:added', onAdded as any);
    canvas.on('object:removed', onRemoved as any);
    canvas.on('before:transform', onBeforeTransform as any);
    canvas.on('object:modified', onModified as any);
    historyControls.attach({ undo, redo, clear });
    publish();

    return () => {
      canvas.off('object:added', onAdded as any);
      canvas.off('object:removed', onRemoved as any);
      canvas.off('before:transform', onBeforeTransform as any);
      canvas.off('object:modified', onModified as any);
      unsubscribe();
      historyControls.detach();
    };
  }, [fabricRef, socket, session, enabled]);
}
