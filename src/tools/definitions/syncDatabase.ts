import { z } from 'zod';
import { syncDatabase } from '../primitives/syncDatabase.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({}).describe("Trigger an OmniFocus database sync against the configured sync server. Useful after a batch of writes so other devices reflect the changes.");

export async function handler(_args: z.infer<typeof schema>, _extra: RequestHandlerExtra) {
  try {
    const result = await syncDatabase();
    if (result.success) {
      return { content: [{ type: "text" as const, text: "✅ OmniFocus sync triggered." }] };
    }
    return {
      content: [{ type: "text" as const, text: `Failed to trigger sync: ${result.error}` }],
      isError: true,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{ type: "text" as const, text: `Error triggering sync: ${error.message}` }],
      isError: true,
    };
  }
}
