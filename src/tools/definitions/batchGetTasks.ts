import { z } from 'zod';
import { batchGetTasks, BatchGetTasksParams } from '../primitives/batchGetTasks.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  ids: z.array(z.string()).min(1).describe("Task (or project) IDs to fetch in one pass. Recurring-instance ids (e.g. \"abc.46.0\") and project-root ids are resolved too."),
}).describe("Read many tasks by id in a single OmniFocus pass — the read counterpart to batch_edit_items. Returns a JSON array with full date/tag/project state per id. Dates are LOCAL-OFFSET ISO (comparable to calendar/ledger). Built for the reverse-sync/reconcile + hydrate flow; far faster than one get_task_by_id per id.");

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra) {
  try {
    const result = await batchGetTasks(args as BatchGetTasksParams);

    if (!result.success && result.tasks.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Batch get failed: ${result.error || 'unknown error'}` }],
        isError: true,
      };
    }

    const found = result.tasks.filter(t => t.found);
    const missing = result.tasks.filter(t => !t.found).map(t => t.id);

    let header = `Fetched ${found.length}/${result.tasks.length} task${result.tasks.length === 1 ? '' : 's'}.`;
    if (missing.length > 0) header += ` Not found: ${missing.join(', ')}.`;

    return {
      content: [{ type: "text" as const, text: header + "\n\n" + JSON.stringify(result.tasks, null, 2) }],
      isError: false,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{ type: "text" as const, text: `Error in batch get: ${error.message}` }],
      isError: true,
    };
  }
}
