import { z } from 'zod';
import { manageTag, ManageTagParams } from '../primitives/manageTag.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  action: z.enum(['create', 'rename', 'delete', 'move', 'set']).describe("Tag lifecycle action. Use 'set' to change properties on an existing tag; 'create' also applies any properties given."),
  name: z.string().describe("The tag to act on (for create: the new tag's name)."),
  newName: z.string().optional().describe("New name (required for rename)."),
  parentName: z.string().optional().describe("Existing tag to nest under (create/move). Omit on create for a top-level tag."),
  deleteContents: z.boolean().optional().describe("delete: also delete child tags (default false → refuse if the tag has children)."),

  // Settable properties (applied on create/move/set).
  status: z.enum(['active', 'onHold', 'dropped']).optional().describe("Tag status — onHold = paused (its tasks become unavailable)."),
  mutuallyExclusive: z.boolean().optional().describe("Make THIS tag's children mutually exclusive (a task can carry only one of them) — e.g. on a 'Modes' group."),
  allowsNextAction: z.boolean().optional().describe("false → tasks with this tag don't count as next actions (e.g. a Waiting tag)."),
}).describe("Create (optionally nested), rename, reparent, delete, or `set` properties of a TAG DEFINITION — structural/property tag ops edit_item can't do. Note: a tag is also auto-created the first time it is applied to a task; use create only for empty tags, hierarchy, or to set properties. Location/geofence is not supported.");

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra) {
  try {
    const result = await manageTag(args as ManageTagParams);
    if (result.success) {
      const where = args.parentName && (args.action === 'create' || args.action === 'move') ? ` under "${args.parentName}"` : '';
      const propNote = result.applied && result.applied.length ? ` [${result.applied.join(', ')}]` : '';
      const label =
        args.action === 'create' ? `Tag "${result.name}" ready${where}` :
        args.action === 'rename' ? `Tag renamed to "${result.name}"` :
        args.action === 'move'   ? `Tag "${result.name}" moved${where}` :
        args.action === 'set'    ? `Tag "${result.name}" updated` :
                                   `Tag "${result.name}" deleted`;
      return { content: [{ type: "text" as const, text: `✅ ${label}${propNote}.` }] };
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
