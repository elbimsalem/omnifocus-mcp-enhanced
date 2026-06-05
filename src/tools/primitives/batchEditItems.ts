import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

/**
 * A single batch edit operation, addressed by task/project id.
 * Tag fields mirror edit_item semantics: replaceTags wins over add/remove.
 * Date fields mirror edit_item: ISO string to set, "" to clear, omit to leave.
 */
export interface BatchEditOperation {
  id: string;
  addTags?: string[];
  removeTags?: string[];
  replaceTags?: string[];
  flagged?: boolean;
  newPlannedDate?: string;
  newDueDate?: string;
  newDeferDate?: string;
  newEstimatedMinutes?: number;
  newStatus?: 'incomplete' | 'completed' | 'dropped';
  // Project-only: reparent into this folder, or to root when ''. Ignored for tasks.
  newFolderName?: string;
}

export interface BatchEditItemsParams {
  // Per-item mode: explicit operations.
  operations?: BatchEditOperation[];
  // Shared-edit mode: apply the same change to every id.
  ids?: string[];
  addTags?: string[];
  removeTags?: string[];
  replaceTags?: string[];
  flagged?: boolean;
  newPlannedDate?: string;
  newDueDate?: string;
  newDeferDate?: string;
  newEstimatedMinutes?: number;
  newStatus?: 'incomplete' | 'completed' | 'dropped';
  newFolderName?: string;
}

export interface BatchEditItemResult {
  id: string;
  name?: string;
  success: boolean;
  changed?: string[];
  error?: string;
}

export interface BatchEditResult {
  success: boolean;
  results: BatchEditItemResult[];
  error?: string;
}

/**
 * Normalize the two input shapes (shared `ids` + edits, or explicit
 * `operations`) into a flat operation list.
 */
export function normalizeOperations(params: BatchEditItemsParams): BatchEditOperation[] {
  if (params.operations && params.operations.length > 0) {
    return params.operations;
  }
  if (params.ids && params.ids.length > 0) {
    return params.ids.map(id => ({
      id,
      addTags: params.addTags,
      removeTags: params.removeTags,
      replaceTags: params.replaceTags,
      flagged: params.flagged,
      newPlannedDate: params.newPlannedDate,
      newDueDate: params.newDueDate,
      newDeferDate: params.newDeferDate,
      newEstimatedMinutes: params.newEstimatedMinutes,
      newStatus: params.newStatus,
      newFolderName: params.newFolderName,
    }));
  }
  return [];
}

/**
 * Apply tag/flag edits to many tasks (or projects) in a single OmniFocus pass.
 *
 * Tags are resolved by name and created on first use, so a brand-new mode tag
 * (e.g. "Focus") is born the moment it is first applied — exactly once per run,
 * even across hundreds of items, because creations are visible to later lookups
 * within the same evaluation.
 */
export async function batchEditItems(params: BatchEditItemsParams): Promise<BatchEditResult> {
  const operations = normalizeOperations(params);

  if (operations.length === 0) {
    return { success: false, results: [], error: 'No operations: provide `operations` or `ids` with at least one edit.' };
  }
  for (const op of operations) {
    if (!op.id) {
      return { success: false, results: [], error: 'Every operation must include an `id`.' };
    }
  }

  const body = `(() => {
    const args = ${JSON.stringify({ operations })};

    function findOrCreateTag(name) {
      let t = flattenedTags.find(tg => tg.name === name);
      if (!t) { t = new Tag(name); }
      return t;
    }
    function findFolder(name) { return flattenedFolders.find(f => f.name === name) || null; }
    function resolveItem(id) {
      let item = Task.byIdentifier(id);
      if (item) return item;
      const p = Project.byIdentifier(id);
      if (p) return p.task; // project root task carries the tags
      return null;
    }

    const results = args.operations.map(op => {
      try {
        const item = resolveItem(op.id);
        if (!item) return { id: op.id, success: false, error: 'not found' };
        const changed = [];

        if (op.replaceTags && op.replaceTags.length) {
          item.clearTags();
          op.replaceTags.forEach(n => item.addTag(findOrCreateTag(n)));
          changed.push('tags(replaced)');
        } else {
          if (op.addTags && op.addTags.length) {
            op.addTags.forEach(n => item.addTag(findOrCreateTag(n)));
            changed.push('tags(added)');
          }
          if (op.removeTags && op.removeTags.length) {
            op.removeTags.forEach(n => {
              const t = flattenedTags.find(tg => tg.name === n);
              if (t) item.removeTag(t);
            });
            changed.push('tags(removed)');
          }
        }

        if (op.flagged !== undefined && op.flagged !== null) {
          item.flagged = op.flagged;
          changed.push('flagged');
        }

        // Dates: ISO string sets it, '' clears it, undefined/null leaves it. (OmniJS Date parses offset ISO.)
        function applyDate(prop, val, label) {
          if (val === undefined || val === null) return;
          item[prop] = (val === '') ? null : new Date(val);
          changed.push(label);
        }
        applyDate('plannedDate', op.newPlannedDate, 'planned');
        applyDate('dueDate', op.newDueDate, 'due');
        applyDate('deferDate', op.newDeferDate, 'defer');

        if (op.newEstimatedMinutes !== undefined && op.newEstimatedMinutes !== null) {
          item.estimatedMinutes = op.newEstimatedMinutes;
          changed.push('estimate');
        }

        if (op.newStatus) {
          if (op.newStatus === 'completed') item.markComplete();
          else if (op.newStatus === 'incomplete') item.markIncomplete();
          else if (op.newStatus === 'dropped') item.drop(false);
          changed.push('status:' + op.newStatus);
        }

        // Project reparent (project-only). '' → root. AppleScript can't do this;
        // moveSections needs the Project section, not its root task.
        if (op.newFolderName !== undefined && op.newFolderName !== null) {
          const proj = Project.byIdentifier(op.id);
          if (!proj) {
            changed.push('folder(skipped: not a project)');
          } else {
            let dest;
            if (op.newFolderName === '') {
              dest = library.ending;
            } else {
              const folder = findFolder(op.newFolderName);
              if (!folder) throw new Error('folder not found: ' + op.newFolderName);
              dest = folder.ending;
            }
            moveSections([proj], dest);
            changed.push('folder');
          }
        }

        return { id: op.id, name: item.name, success: true, changed };
      } catch (e) {
        return { id: op.id, success: false, error: String((e && e.message) ? e.message : e) };
      }
    });

    return JSON.stringify({ success: results.some(r => r.success), results });
  })()`;

  const res = await evaluateOmniJs<BatchEditResult>(body);
  if (!res || typeof res !== 'object' || !('results' in res)) {
    return { success: false, results: [], error: (res as any)?.error || 'Unexpected OmniJS result' };
  }
  return res;
}
