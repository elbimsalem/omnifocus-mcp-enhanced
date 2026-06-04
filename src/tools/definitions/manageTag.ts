import { z } from 'zod';
import { manageTag, ManageTagParams } from '../primitives/manageTag.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  action: z.enum(['create', 'rename', 'delete', 'move']).describe("Tag lifecycle action."),
  name: z.string().describe("The tag to act on (for create: the new tag's name)."),
  newName: z.string().optional().describe("New name (required for rename)."),
  parentName: z.string().optional().describe("Existing tag to nest under (create/move). Omit on create for a top-level tag."),
  deleteContents: z.boolean().optional().describe("delete: also delete child tags (default false → refuse if the tag has children)."),
}).describe("Create (optionally nested under a parent), rename, reparent, or delete a TAG DEFINITION — the structural tag ops edit_item can't do. Note: a tag is also auto-created the first time it is applied to a task; use create only for empty tags or hierarchy.");

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra) {
  try {
    const result = await manageTag(args as ManageTagParams);
    if (result.success) {
      const where = args.parentName && (args.action === 'create' || args.action === 'move') ? ` under "${args.parentName}"` : '';
      const label =
        args.action === 'create' ? `Tag "${result.name}" ready${where}` :
        args.action === 'rename' ? `Tag renamed to "${result.name}"` :
        args.action === 'move'   ? `Tag "${result.name}" moved${where}` :
                                   `Tag "${result.name}" deleted`;
      return { content: [{ type: "text" as const, text: `✅ ${label}.` }] };
    }
    return {
      content: [{ type: "text" as const, text: `Failed to ${args.action} tag: ${result.error}` }],
      isError: true,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{ type: "text" as const, text: `Error managing tag: ${error.message}` }],
      isError: true,
    };
  }
}
