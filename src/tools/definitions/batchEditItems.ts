import { z } from 'zod';
import { batchEditItems, BatchEditItemsParams } from '../primitives/batchEditItems.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

const ISO_DATE = "ISO date (YYYY-MM-DD or full offset ISO like 2026-06-04T14:31:00+02:00); \"\" clears it; omit to leave unchanged.";
const STATUS = z.enum(["incomplete", "completed", "dropped"]);

export const schema = z.object({
  // Shared-edit mode: same change applied to every id.
  ids: z.array(z.string()).optional().describe("Task/project IDs to apply the SAME edit to (shared-edit mode). Combine with the shared fields below."),
  addTags: z.array(z.string()).optional().describe("Shared mode: tags to add to every id (created if missing)."),
  removeTags: z.array(z.string()).optional().describe("Shared mode: tags to remove from every id."),
  replaceTags: z.array(z.string()).optional().describe("Shared mode: replace ALL tags on every id with these (wins over add/remove)."),
  flagged: z.boolean().optional().describe("Shared mode: set flagged on every id."),
  newPlannedDate: z.string().optional().describe("Shared mode: planned date for every id. " + ISO_DATE),
  newDueDate: z.string().optional().describe("Shared mode: due date for every id. " + ISO_DATE),
  newDeferDate: z.string().optional().describe("Shared mode: defer date for every id. " + ISO_DATE),
  newEstimatedMinutes: z.number().optional().describe("Shared mode: estimated minutes for every id."),
  newStatus: STATUS.optional().describe("Shared mode: task status for every id."),
  newFolderName: z.string().optional().describe("Shared mode: PROJECT-only. Reparent every id into this folder (e.g. fold strays into AREAS); \"\" moves to root (un-folder). Ignored for task ids."),

  // Per-item mode: explicit, possibly heterogeneous, operations.
  operations: z.array(z.object({
    id: z.string().describe("Task or project ID."),
    addTags: z.array(z.string()).optional().describe("Tags to add (created if missing)."),
    removeTags: z.array(z.string()).optional().describe("Tags to remove."),
    replaceTags: z.array(z.string()).optional().describe("Replace ALL tags with these (wins over add/remove)."),
    flagged: z.boolean().optional().describe("Set flagged status."),
    newPlannedDate: z.string().optional().describe("Planned date. " + ISO_DATE),
    newDueDate: z.string().optional().describe("Due date. " + ISO_DATE),
    newDeferDate: z.string().optional().describe("Defer date. " + ISO_DATE),
    newEstimatedMinutes: z.number().optional().describe("Estimated minutes."),
    newStatus: STATUS.optional().describe("Task status."),
    newFolderName: z.string().optional().describe("PROJECT-only: reparent into this folder; \"\" moves to root. Ignored for task ids."),
  })).optional().describe("Explicit per-item operations (per-item mode). Use INSTEAD of ids+shared edits when items need different changes — e.g. setting a different planned date per task in one reconcile-apply."),
}).describe("Apply tag/flag/date/status edits — and project folder-moves — to many tasks (or projects) in a single OmniFocus pass. Additive by default. Provide either `ids` + a shared edit, or `operations` for per-item edits. Collapses a whole reconcile-apply (N planned-date writes) or a folder cleanup (fold N strays at once) into one call.");

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
