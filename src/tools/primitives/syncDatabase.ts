import { executeAppleScript } from '../../utils/scriptExecution.js';

export interface SyncDatabaseResult {
  success: boolean;
  error?: string;
}

/**
 * Trigger an OmniFocus database sync (push/pull against the configured sync
 * server) via the AppleScript-dictionary `synchronize` command. Useful after a
 * batch of writes so other devices reflect the changes immediately.
 *
 * Note: `synchronize` returns once the sync has been kicked off / the local
 * round-trip completes; it is not a guarantee that every remote device has
 * pulled. There is no OmniJS equivalent, so this uses AppleScript.
 */
export async function syncDatabase(): Promise<SyncDatabaseResult> {
  const script = `
  try
    tell application "OmniFocus" to synchronize
    return "{\\\"success\\\":true}"
  on error errorMessage
    return "{\\\"success\\\":false,\\\"error\\\":\\"" & errorMessage & "\\\"}"
  end try
  `;

  try {
    const stdout = await executeAppleScript(script);
    try {
      return JSON.parse(stdout) as SyncDatabaseResult;
    } catch {
      return { success: false, error: `Unparseable sync output: ${stdout}` };
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to trigger sync' };
  }
}
