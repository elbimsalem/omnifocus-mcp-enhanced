import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

export type TagAction = 'create' | 'rename' | 'delete' | 'move' | 'set';
export type TagStatus = 'active' | 'onHold' | 'dropped';

export interface ManageTagParams {
  action: TagAction;
  name: string;          // target tag name (for create: the new tag's name)
  newName?: string;      // rename target
  parentName?: string;   // create/move: nest under this existing tag (omit create → top level)
  deleteContents?: boolean; // delete: also delete child tags (default false → refuse if children exist)

  // Settable properties (applied on `create` and `set`):
  status?: TagStatus;            // active | onHold (paused) | dropped
  mutuallyExclusive?: boolean;   // make this tag's CHILDREN mutually exclusive (group setting)
  allowsNextAction?: boolean;    // false → tasks with this tag don't count as next actions (e.g. Waiting)
}

export interface ManageTagResult {
  success: boolean;
  action?: TagAction;
  id?: string;
  name?: string;
  applied?: string[];
  error?: string;
}

/**
 * Tag lifecycle + properties that single-task edit_item can't reach: create an
 * empty tag (optionally nested under a parent — e.g. a "Modes" group), rename,
 * reparent, delete the tag definition, or `set` its status (paused = onHold),
 * mutual-exclusivity of its children, and next-action behaviour.
 *
 * OmniJS notes: tag nesting takes an *insertion location* (`parent.ending`),
 * not the parent object. `flattenedTags` is a real Array (so `.find` works).
 * Location/geofence is intentionally unsupported (not exposed by the OmniJS API).
 */
export async function manageTag(params: ManageTagParams): Promise<ManageTagResult> {
  const body = `(() => {
    const args = ${JSON.stringify(params)};
    function findTag(name) { return flattenedTags.find(t => t.name === name) || null; }
    function statusEnum(s) {
      if (s === 'active') return Tag.Status.Active;
      if (s === 'onHold') return Tag.Status.OnHold;
      if (s === 'dropped') return Tag.Status.Dropped;
      return null;
    }
    // Apply the optional settable properties to a resolved tag; returns labels.
    function applyProps(tag) {
      const applied = [];
      if (args.status !== undefined && args.status !== null) {
        const st = statusEnum(args.status);
        if (st === null) throw new Error('Invalid status: ' + args.status);
        tag.status = st; applied.push('status=' + args.status);
      }
      if (args.mutuallyExclusive !== undefined && args.mutuallyExclusive !== null) {
        tag.childrenAreMutuallyExclusive = args.mutuallyExclusive;
        applied.push('mutuallyExclusive=' + args.mutuallyExclusive);
      }
      if (args.allowsNextAction !== undefined && args.allowsNextAction !== null) {
        tag.allowsNextAction = args.allowsNextAction;
        applied.push('allowsNextAction=' + args.allowsNextAction);
      }
      return applied;
    }

    try {
      if (args.action === 'create') {
        let parent = null;
        if (args.parentName) {
          parent = findTag(args.parentName);
          if (!parent) return JSON.stringify({ success: false, error: 'Parent tag not found: ' + args.parentName });
        }
        let tag = findTag(args.name);
        if (tag) {
          if (parent && (!tag.parent || tag.parent.name !== args.parentName)) moveTags([tag], parent.ending);
        } else {
          tag = parent ? new Tag(args.name, parent.ending) : new Tag(args.name);
        }
        const applied = applyProps(tag);
        return JSON.stringify({ success: true, action: 'create', id: tag.id.primaryKey, name: tag.name, applied });
      }

      if (args.action === 'set') {
        const tag = findTag(args.name);
        if (!tag) return JSON.stringify({ success: false, error: 'Tag not found: ' + args.name });
        const applied = applyProps(tag);
        if (applied.length === 0) return JSON.stringify({ success: false, error: 'set requires at least one of status/mutuallyExclusive/allowsNextAction' });
        return JSON.stringify({ success: true, action: 'set', id: tag.id.primaryKey, name: tag.name, applied });
      }

      if (args.action === 'rename') {
        const tag = findTag(args.name);
        if (!tag) return JSON.stringify({ success: false, error: 'Tag not found: ' + args.name });
        if (!args.newName) return JSON.stringify({ success: false, error: 'newName required for rename' });
        tag.name = args.newName;
        return JSON.stringify({ success: true, action: 'rename', id: tag.id.primaryKey, name: tag.name });
      }

      if (args.action === 'move') {
        const tag = findTag(args.name);
        if (!tag) return JSON.stringify({ success: false, error: 'Tag not found: ' + args.name });
        if (!args.parentName) return JSON.stringify({ success: false, error: 'parentName required for move (reparent under a tag)' });
        const parent = findTag(args.parentName);
        if (!parent) return JSON.stringify({ success: false, error: 'Parent tag not found: ' + args.parentName });
        moveTags([tag], parent.ending);
        const applied = applyProps(tag);
        return JSON.stringify({ success: true, action: 'move', id: tag.id.primaryKey, name: tag.name, applied });
      }

      if (args.action === 'delete') {
        const tag = findTag(args.name);
        if (!tag) return JSON.stringify({ success: false, error: 'Tag not found: ' + args.name });
        const childCount = tag.children ? tag.children.length : 0;
        if (childCount > 0 && !args.deleteContents) {
          return JSON.stringify({ success: false, error: 'Tag "' + tag.name + '" has ' + childCount + ' child tag(s). Reparent them or pass deleteContents:true.' });
        }
        const name = tag.name;
        deleteObject(tag);
        return JSON.stringify({ success: true, action: 'delete', name: name });
      }

      return JSON.stringify({ success: false, error: 'Unknown action: ' + args.action });
    } catch (e) {
      return JSON.stringify({ success: false, error: String((e && e.message) ? e.message : e) });
    }
  })()`;

  return evaluateOmniJs<ManageTagResult>(body);
}
