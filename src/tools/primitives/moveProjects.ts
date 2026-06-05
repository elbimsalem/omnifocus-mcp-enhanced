import { evaluateOmniJs } from '../../utils/evaluateOmniJs.js';

/**
 * A single project reparent: move project `id` into folder `folderName`, or to
 * the top level when `folderName` is null or '' (un-folder).
 */
export interface ProjectMove {
  id: string;
  folderName: string | null;
}

export interface ProjectMoveResult {
  id: string;
  name?: string;
  folder?: string;
  success: boolean;
  error?: string;
}

export interface MoveProjectsResult {
  success: boolean;
  results: ProjectMoveResult[];
  error?: string;
}

/**
 * Build the OmniJS body that reparents one or more projects in a single pass.
 *
 * AppleScript's `move project to folder` is unsupported in OmniFocus' dictionary
 * ("Replacement not supported currently"), so reparenting MUST go through the
 * OmniJS bridge. `moveSections` is natively array-shaped, so moving N projects
 * costs the same single evaluation as moving one — batch falls out for free.
 *
 * `folderName: null | ''` moves the project to the library top level (root).
 */
export function buildMoveProjectsOmniJs(moves: ProjectMove[]): string {
  return `(() => {
    const moves = ${JSON.stringify(moves)};
    function findFolder(name) { return flattenedFolders.find(f => f.name === name) || null; }

    const results = moves.map(m => {
      try {
        const proj = Project.byIdentifier(m.id);
        if (!proj) return { id: m.id, success: false, error: 'project not found: ' + m.id };

        let dest, destLabel;
        if (m.folderName === null || m.folderName === '') {
          dest = library.ending;        // top level
          destLabel = '(root)';
        } else {
          const folder = findFolder(m.folderName);
          if (!folder) return { id: m.id, success: false, error: 'folder not found: ' + m.folderName };
          dest = folder.ending;
          destLabel = folder.name;
        }

        moveSections([proj], dest);
        return { id: m.id, name: proj.name, folder: destLabel, success: true };
      } catch (e) {
        return { id: m.id, success: false, error: String((e && e.message) ? e.message : e) };
      }
    });

    return JSON.stringify({ success: results.some(r => r.success), results });
  })()`;
}

/**
 * Reparent one or more projects (into a folder, or to root) via the OmniJS bridge.
 */
export async function moveProjects(moves: ProjectMove[]): Promise<MoveProjectsResult> {
  if (!moves || moves.length === 0) {
    return { success: false, results: [], error: 'No moves: provide at least one project move.' };
  }
  for (const m of moves) {
    if (!m.id) return { success: false, results: [], error: 'Every move must include an `id`.' };
  }

  const res = await evaluateOmniJs<MoveProjectsResult>(buildMoveProjectsOmniJs(moves));
  if (!res || typeof res !== 'object' || !('results' in res)) {
    return { success: false, results: [], error: (res as any)?.error || 'Unexpected OmniJS result' };
  }
  return res;
}
