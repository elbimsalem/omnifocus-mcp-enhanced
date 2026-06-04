import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

export type FolderAction = 'create' | 'rename' | 'delete';

export interface ManageFolderParams {
  action: FolderAction;
  name: string;          // target folder (for create: the new folder's name)
  newName?: string;      // rename target
  parentName?: string;   // create: nest under this existing folder (omit → top level)
  deleteContents?: boolean; // delete: also delete contained projects/folders (default false → refuse if non-empty)
}

export interface ManageFolderResult {
  success: boolean;
  action?: FolderAction;
  id?: string;
  name?: string;
  error?: string;
}

/**
 * Folder lifecycle the rest of the API can't reach: create a folder (optionally
 * nested), rename one (e.g. the long-standing FINCANES → FINANCES typo fix), or
 * delete an empty folder. Moving a project INTO a folder already works via
 * edit_item(newFolderName); this covers the structural folder ops it doesn't.
 */
export async function manageFolder(params: ManageFolderParams): Promise<ManageFolderResult> {
  const body = `(() => {
    const args = ${JSON.stringify(params)};
    function findFolder(name) { return flattenedFolders.find(f => f.name === name) || null; }

    try {
      if (args.action === 'create') {
        let parent = null;
        if (args.parentName) {
          parent = findFolder(args.parentName);
          if (!parent) return JSON.stringify({ success: false, error: 'Parent folder not found: ' + args.parentName });
        }
        let folder = findFolder(args.name);
        if (folder) return JSON.stringify({ success: true, action: 'create', id: folder.id.primaryKey, name: folder.name });
        folder = parent ? new Folder(args.name, parent.ending) : new Folder(args.name);
        return JSON.stringify({ success: true, action: 'create', id: folder.id.primaryKey, name: folder.name });
      }

      if (args.action === 'rename') {
        const folder = findFolder(args.name);
        if (!folder) return JSON.stringify({ success: false, error: 'Folder not found: ' + args.name });
        if (!args.newName) return JSON.stringify({ success: false, error: 'newName required for rename' });
        folder.name = args.newName;
        return JSON.stringify({ success: true, action: 'rename', id: folder.id.primaryKey, name: folder.name });
      }

      if (args.action === 'delete') {
        const folder = findFolder(args.name);
        if (!folder) return JSON.stringify({ success: false, error: 'Folder not found: ' + args.name });
        const childCount = (folder.folders ? folder.folders.length : 0) + (folder.projects ? folder.projects.length : 0);
        if (childCount > 0 && !args.deleteContents) {
          return JSON.stringify({ success: false, error: 'Folder "' + folder.name + '" contains ' + childCount + ' item(s). Move them out or pass deleteContents:true.' });
        }
        const name = folder.name;
        deleteObject(folder);
        return JSON.stringify({ success: true, action: 'delete', name: name });
      }

      return JSON.stringify({ success: false, error: 'Unknown action: ' + args.action });
    } catch (e) {
      return JSON.stringify({ success: false, error: String((e && e.message) ? e.message : e) });
    }
  })()`;

  return evaluateOmniJs<ManageFolderResult>(body);
}
