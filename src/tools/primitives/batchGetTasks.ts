import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

/**
 * Read many tasks by id in a single OmniFocus pass — the read counterpart to
 * batch_edit_items. Built for the reverse-sync / reconcile flow, which needs the
 * full date/tag/project state of a known set of task ids (bound ledger ids +
 * planned-window tasks) without firing one get_task_by_id per id.
 *
 * Dates are emitted as LOCAL-OFFSET ISO (e.g. "2026-06-04T13:31:00+02:00") — NOT
 * UTC — so the first 16 chars are local wall time, directly comparable to PLAN
 * calendar event starts and the `{id @ baseline}` ledger (both local wall time).
 * (get_task_by_id returns UTC and reformats for display; this tool's consumer is
 * programmatic, so it returns the comparable form up front.)
 *
 * Taxonomy-agnostic: returns the raw `tags` array. The caller derives any domain
 * notion of "mode" (Focus/Message/…) from it — the fork hardcodes no taxonomy.
 */
export interface BatchGetTasksParams {
  ids: string[];
}

export interface BatchTaskInfo {
  id: string;
  found: boolean;
  name?: string;
  projectId?: string | null;
  projectName?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  planned?: string | null;
  due?: string | null;
  defer?: string | null;
  completed?: boolean;
  dropped?: boolean;
  flagged?: boolean;
  tags?: string[];
  estimateMinutes?: number | null;
  hasChildren?: boolean;
  childCount?: number;
  hasNote?: boolean;
}

export interface BatchGetTasksResult {
  success: boolean;
  tasks: BatchTaskInfo[];
  error?: string;
}

export async function batchGetTasks(params: BatchGetTasksParams): Promise<BatchGetTasksResult> {
  const ids = params.ids || [];
  if (ids.length === 0) {
    return { success: false, tasks: [], error: 'Provide at least one id in `ids`.' };
  }

  const body = `(() => {
    const ids = ${JSON.stringify(ids)};

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    // Local-offset ISO so first-16 chars are local wall time (comparable to calendar + ledger).
    function isoLocal(d) {
      if (!d) return null;
      const off = -d.getTimezoneOffset();      // minutes east of UTC
      const s = off >= 0 ? '+' : '-';
      const ao = Math.abs(off);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
             pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
             s + pad(Math.floor(ao / 60)) + ':' + pad(ao % 60);
    }

    // Build a primaryKey -> task map once (O(n)); covers recurring-instance ids
    // (e.g. "abc.46.0") that Task.byIdentifier may not resolve directly.
    const byKey = {};
    flattenedTasks.forEach(t => { byKey[t.id.primaryKey] = t; });
    function resolve(id) {
      let t = Task.byIdentifier(id);
      if (t) return t;
      if (byKey[id]) return byKey[id];
      const p = Project.byIdentifier(id);
      if (p) return p.task;   // project root task carries dates/tags
      return null;
    }
    function isDropped(t) {
      try { return t.taskStatus === Task.Status.Dropped; } catch (e) { return false; }
    }

    const tasks = ids.map(id => {
      const t = resolve(id);
      if (!t) return { id, found: false };
      const proj = t.containingProject || null;
      const parent = t.parent || null;
      const note = t.note || '';
      return {
        id: t.id.primaryKey,
        found: true,
        name: t.name,
        projectId: proj ? proj.id.primaryKey : null,
        projectName: proj ? proj.name : null,
        parentId: parent ? parent.id.primaryKey : null,
        parentName: parent ? parent.name : null,
        planned: isoLocal(t.plannedDate),
        due: isoLocal(t.dueDate),
        defer: isoLocal(t.deferDate),
        completed: !!t.completed,
        dropped: isDropped(t),
        flagged: !!t.flagged,
        tags: (t.tags || []).map(tg => tg.name),
        estimateMinutes: (t.estimatedMinutes !== null && t.estimatedMinutes !== undefined) ? t.estimatedMinutes : null,
        hasChildren: (t.children || []).length > 0,
        childCount: (t.children || []).length,
        hasNote: !!(note && note.length)
      };
    });

    return JSON.stringify({ success: true, tasks });
  })()`;

  const res = await evaluateOmniJs<BatchGetTasksResult>(body);
  if (!res || typeof res !== 'object' || !('tasks' in res)) {
    return { success: false, tasks: [], error: (res as any)?.error || 'Unexpected OmniJS result' };
  }
  return res;
}
