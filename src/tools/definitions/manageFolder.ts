import { z } from 'zod';
import { manageFolder, ManageFolderParams } from '../primitives/manageFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  action: z.enum(['create', 'rename', 'delete']).describe("Folder lifecycle action."),
  name: z.string().describe("The folder to act on (for create: the new folder's name)."),
  newName: z.string().optional().describe("New name (required for rename — e.g. FINCANES → FINANCES)."),
  parentName: z.string().optional().describe("Existing folder to nest under (create). Omit for a top-level folder."),
  deleteContents: z.boolean().optional().describe("delete: also delete contained projects/folders (default false → refuse if non-empty)."),
}).describe("Create (optionally nested), rename, or delete a FOLDER. Moving a project into a folder already works via edit_item(newFolderName); this covers the structural folder ops it doesn't.");

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra) {
  try {
    const result = await manageFolder(args as ManageFolderParams);
    if (result.success) {
      const where = args.parentName && args.action === 'create' ? ` under "${args.parentName}"` : '';
      const label =
        args.action === 'create' ? `Folder "${result.name}" ready${where}` :
        args.action === 'rename' ? `Folder renamed to "${result.name}"` :
                                   `Folder "${result.name}" deleted`;
      return { content: [{ type: "text" as const, text: `✅ ${label}.` }] };
    }
    return {
      content: [{ type: "text" as const, text: `Failed to ${args.action} folder: ${result.error}` }],
      isError: true,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{ type: "text" as const, text: `Error managing folder: ${error.message}` }],
      isError: true,
    };
  }
}
