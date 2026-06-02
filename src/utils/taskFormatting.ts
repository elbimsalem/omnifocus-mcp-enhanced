// Shared, emoji-free task rendering used by all list/read tools (filter_tasks,
// forecast, flagged, inbox, tasks-by-tag) so their output is consistent.

// Format an ISO datetime string as a plain YYYY-MM-DD date.
export function formatDateOnly(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface TaskLineOptions {
  // Include a "project:" field in the metadata line. Use for tools that do NOT
  // already group by project (e.g. forecast groups by date).
  includeProject?: boolean;
  // Suppress the "[flagged]" qualifier (e.g. the flagged-tasks tool, where every
  // row is flagged so the marker is redundant).
  suppressFlagged?: boolean;
}

// Render a single task as clean, emoji-free text:
//   - <name> [<qualifiers>]
//       key: value | key: value
//       note: ...
//
// An action group is any task with children. OmniFocus marks any parent with
// open children as "Blocked", which is noise — we label it "group" and report
// the count of open descendants (the real size of the batch) instead.
export function formatTaskLine(task: any, opts: TaskLineOptions = {}): string {
  const isGroup = (task.childrenCount ?? 0) > 0;

  // Title line with bracketed qualifiers
  const qualifiers: string[] = [];
  if (task.flagged && !opts.suppressFlagged) qualifiers.push('flagged');
  if (isGroup) {
    const open = task.openChildrenCount ?? task.childrenCount;
    qualifiers.push(`group, ${open} ${open === 1 ? 'item' : 'items'}`);
  }
  let output = `- ${task.name}`;
  if (qualifiers.length > 0) output += ` [${qualifiers.join('; ')}]`;
  output += '\n';

  // Indented metadata line
  const meta: string[] = [];

  // Status — skip "Available" (the default); suppress "Blocked" for groups
  if (!isGroup && task.taskStatus && task.taskStatus !== 'Available') {
    meta.push(`status: ${task.taskStatus}`);
  }

  // Forecast distinguishes due vs deferred via isDue
  if (typeof task.isDue === 'boolean') {
    meta.push(`kind: ${task.isDue ? 'due' : 'deferred'}`);
  }

  if (task.dueDate) {
    const overdue = new Date(task.dueDate) < new Date();
    meta.push(`due: ${formatDateOnly(task.dueDate)}${overdue ? ' (overdue)' : ''}`);
  }
  if (task.deferDate) meta.push(`defer: ${formatDateOnly(task.deferDate)}`);
  if (task.plannedDate) meta.push(`plan: ${formatDateOnly(task.plannedDate)}`);
  if (task.completedDate) meta.push(`done: ${formatDateOnly(task.completedDate)}`);

  if (task.estimatedMinutes) {
    const hours = Math.floor(task.estimatedMinutes / 60);
    const minutes = task.estimatedMinutes % 60;
    meta.push(`est: ${hours > 0 ? `${hours}h${minutes > 0 ? `${minutes}m` : ''}` : `${minutes}m`}`);
  }

  if (opts.includeProject && task.projectName) {
    meta.push(`project: ${task.projectName}`);
  }

  if (task.id) meta.push(`id: ${task.id}`);

  if (task.tags && task.tags.length > 0) {
    meta.push(`tags: ${task.tags.map((tag: any) => tag.name).join(', ')}`);
  }

  if (meta.length > 0) output += `    ${meta.join(' | ')}\n`;

  if (task.note && task.note.trim()) {
    output += `    note: ${task.note.trim().replace(/\n/g, '\n    ')}\n`;
  }

  return output;
}
