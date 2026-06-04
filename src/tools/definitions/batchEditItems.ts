import { z } from 'zod';
import { batchEditItems, BatchEditItemsParams } from '../primitives/batchEditItems.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  // Shared-edit mode: same change applied to every id.
  ids: z.array(z.string()).optional().describe("Task/project IDs to apply the SAME edit to (shared-edit mode). Combine with addTags/removeTags/replaceTags/flagged below."),
  addTags: z.array(z.string()).optional().describe("Shared mode: tags to add to every id (created if missing)."),
  removeTags: z.array(z.string()).optional().describe("Shared mode: tags to remove from every id."),
  replaceTags: z.array(z.string()).optional().describe("Shared mode: replace ALL tags on every id with these (wins over add/remove)."),
  flagged: z.boolean().optional().describe("Shared mode: set flagged on every id."),

  // Per-item mode: explicit, possibly heterogeneous, operations.
  operations: z.array(z.object({
    id: z.string().describe("Task or project ID."),
    addTags: z.array(z.string()).optional().describe("Tags to add (created if missing)."),
    removeTags: z.array(z.string()).optional().describe("Tags to remove."),
    replaceTags: z.array(z.string()).optional().describe("Replace ALL tags with these (wins over add/remove)."),
    flagged: z.boolean().optional().describe("Set flagged status."),
  })).optional().describe("Explicit per-item operations (per-item mode). Use INSTEAD of ids+shared edits when items need different changes."),
}).describe("Apply tag/flag edits to many tasks (or projects) in a single OmniFocus pass. Additive by default. Provide either `ids` + a shared edit, or `operations` for per-item edits.");

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra) {
  try {
    const result = await batchEditItems(args as BatchEditItemsParams);

    if (!result.success && result.results.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Batch edit failed: ${result.error || 'unknown error'}` }],
        isError: true,
      };
    }

    const ok = result.results.filter(r => r.success);
    const failed = result.results.filter(r => !r.success);

    let message = `✅ Edited ${ok.length} item${ok.length === 1 ? '' : 's'}.`;
    if (failed.length > 0) message += ` ⚠️ ${failed.length} failed.`;

    const failDetails = failed.length > 0
      ? '\n\n' + failed.map(f => `- ❌ ${f.id} — ${f.error}`).join('\n')
      : '';

    return {
      content: [{ type: "text" as const, text: message + failDetails }],
      isError: failed.length > 0 && ok.length === 0,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{ type: "text" as const, text: `Error in batch edit: ${error.message}` }],
      isError: true,
    };
  }
}
