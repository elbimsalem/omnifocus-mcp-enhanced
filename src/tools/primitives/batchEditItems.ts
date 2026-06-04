import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

/**
 * A single batch edit operation, addressed by task/project id.
 * Tag fields mirror edit_item semantics: replaceTags wins over add/remove.
 */
export interface BatchEditOperation {
  id: string;
  addTags?: string[];
  removeTags?: string[];
  replaceTags?: string[];
  flagged?: boolean;
}

export interface BatchEditItemsParams {
  // Per-item mode: explicit operations.
  operations?: BatchEditOperation[];
  // Shared-edit mode: apply the same tag/flag change to every id.
  ids?: string[];
  addTags?: string[];
  removeTags?: string[];
  replaceTags?: string[];
  flagged?: boolean;
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
