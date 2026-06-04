import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

export type TagAction = 'create' | 'rename' | 'delete' | 'move';

export interface ManageTagParams {
  action: TagAction;
  name: string;          // target tag name (for create: the new tag's name)
  newName?: string;      // rename target
  parentName?: string;   // create/move: nest under this existing tag (omit create → top level)
  deleteContents?: boolean; // delete: also delete child tags (default false → refuse if children exist)
}

export interface ManageTagResult {
  success: boolean;
  action?: TagAction;
  id?: string;
  name?: string;
  error?: string;
}

/**
 * Tag lifecycle the single-task edit_item can't reach: create an empty tag
 * (optionally nested under a parent — e.g. a "Modes" group), rename a tag,
 * reparent it, or delete the tag definition itself (not just strip it off tasks).
 *
 * OmniJS notes: tag nesting takes an *insertion location* (`parent.ending`),
 * not the parent object. `flattenedTags` is a real Array (so `.find` works).
 */
export async function manageTag(params: ManageTagParams): Promise<ManageTagResult> {
  const body = `(() => {
    const args = ${JSON.stringify(params)};
    function findTag(name) { return flattenedTags.find(t => t.name === name) || null; }

    try {
      if (args.action === 'create') {
        let parent = null;
        if (args.parentName) {
          parent = findTag(args.parentName);
          if (!parent) return JSON.stringify({ success: false, error: 'Parent tag not found: ' + args.parentName });
        }
        let tag = findTag(args.name);
        if (tag) {
          // Idempotent: exists already; nest it if a parent was requested and it isn't there yet.
          if (parent && (!tag.parent || tag.parent.name !== args.parentName)) moveTags([tag], parent.ending);
          return JSON.stringify({ success: true, action: 'create', id: tag.id.primaryKey, name: tag.name });
        }
        tag = parent ? new Tag(args.name, parent.ending) : new Tag(args.name);
        return JSON.stringify({ success: true, action: 'create', id: tag.id.primaryKey, name: tag.name });
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
        return JSON.stringify({ success: true, action: 'move', id: tag.id.primaryKey, name: tag.name });
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
