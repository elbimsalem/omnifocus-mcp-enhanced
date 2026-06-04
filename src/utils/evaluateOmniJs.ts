import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

/**
 * Evaluate an Omni Automation (OmniJS) script inside OmniFocus via the
 * `Application('OmniFocus').evaluateJavascript(...)` bridge.
 *
 * OmniJS exposes the structural API (Tag, Folder, Task.byIdentifier,
 * addTag/removeTag/clearTags, moveTags, new Folder, deleteObject, ...) that
 * plain AppleScript handles awkwardly — and a whole batch runs in a single
 * `osascript` invocation instead of one spawn per item.
 *
 * The OmniJS body is expected to evaluate to a JSON STRING (e.g. end with an
 * IIFE returning `JSON.stringify(result)`). This function returns the parsed
 * object. On any failure it resolves to `{ success: false, error }` rather than
 * throwing, so batch callers get a structured result.
 */
export async function evaluateOmniJs<T = any>(omniJsBody: string): Promise<T> {
  const tempFile = join(tmpdir(), `ofomnijs_${Date.now()}_${process.pid}.js`);

  // JSON.stringify safely embeds the OmniJS source as a JS string literal for
  // the JXA host, sidestepping backtick/${} escaping issues.
  const jxaScript = `
    function run() {
      const app = Application('OmniFocus');
      app.includeStandardAdditions = true;
      try {
        return app.evaluateJavascript(${JSON.stringify(omniJsBody)});
      } catch (e) {
        return JSON.stringify({ success: false, error: String((e && e.message) ? e.message : e) });
      }
    }
  `;

  try {
    writeFileSync(tempFile, jxaScript);
    const { stdout, stderr } = await execAsync(
      `osascript -l JavaScript ${tempFile}`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    if (stderr) {
      console.error('OmniJS stderr:', stderr);
    }
    const trimmed = stdout.trim();
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return { success: false, error: `Unparseable OmniJS output: ${trimmed}` } as unknown as T;
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to execute OmniJS' } as unknown as T;
  } finally {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
  }
}
