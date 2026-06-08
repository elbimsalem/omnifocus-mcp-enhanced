import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTagAssignmentScript, generateAppleScript, buildRepetitionOmniJs } from './addOmniFocusTask.js';

test('buildRepetitionOmniJs sets a repetition rule by task id with a defensive method lookup', () => {
  const js = buildRepetitionOmniJs('abc123', 'FREQ=WEEKLY', 'fixed');
  assert.match(js, /Task\.byIdentifier\("abc123"\)/);
  assert.match(js, /Task not found/);
  assert.match(js, /new Task\.RepetitionRule\("FREQ=WEEKLY", method\)/);
  assert.match(js, /method = RM\.Fixed/);
  assert.match(js, /JSON\.stringify\(\{ success: true/);
});

test('buildRepetitionOmniJs maps due-after-completion with a DueDate fallback', () => {
  const js = buildRepetitionOmniJs('t1', 'FREQ=MONTHLY;BYDAY=1MO', 'due-after-completion');
  assert.match(js, /RM\.DueAfterCompletion !== undefined \? RM\.DueAfterCompletion : RM\.DueDate/);
  assert.match(js, /new Task\.RepetitionRule\("FREQ=MONTHLY;BYDAY=1MO", method\)/);
});

test('buildRepetitionOmniJs maps defer-until-date and defaults method to fixed', () => {
  assert.match(buildRepetitionOmniJs('t2', 'FREQ=DAILY;INTERVAL=2', 'defer-until-date'), /method = RM\.DeferUntilDate/);
  // omitted method → 'fixed' embedded
  assert.match(buildRepetitionOmniJs('t3', 'FREQ=WEEKLY'), /const m = "fixed"/);
});

test('buildTagAssignmentScript creates missing tags before assignment', () => {
  const script = buildTagAssignmentScript(['mcp-test-tag'], 'newTask');

  assert.match(script, /set theTag to first flattened tag where name = "mcp-test-tag"/);
  assert.match(script, /if theTag is missing value then/);
  assert.match(script, /set theTag to make new tag with properties \{name:"mcp-test-tag"\}/);
  assert.match(script, /add theTag to tags of newTask/);
});

test('generateAppleScript builds date variables before OmniFocus tell block', () => {
  const script = generateAppleScript({
    name: 'Task with dates',
    dueDate: '2026-02-27',
    deferDate: '2026-02-25',
    plannedDate: '2026-02-24'
  });

  const tellIndex = script.indexOf('tell application "OmniFocus"');
  const preambleIndex = script.indexOf('set dueDateValue to current date');
  assert.ok(preambleIndex > -1 && preambleIndex < tellIndex);

  assert.match(script, /set due date of newTask to dueDateValue/);
  assert.match(script, /set defer date of newTask to deferDateValue/);
  assert.match(script, /set planned date of newTask to plannedDateValue/);

  assert.doesNotMatch(script, /set due date of newTask to date "/);
  assert.doesNotMatch(script, /set defer date of newTask to date "/);
  assert.doesNotMatch(script, /set planned date of newTask to date "/);
});

test('generateAppleScript keeps apostrophes and doubles backslashes in task text fields', () => {
  const script = generateAppleScript({
    name: "Review client's \\ draft",
    note: "Check Bob's file in C:\\Temp"
  });

  assert.match(script, /make new inbox task with properties \{name:"Review client's \\\\ draft"\}/);
  assert.match(script, /set note of newTask to "Check Bob's file in C:\\\\Temp"/);
  assert.doesNotMatch(script, /\\'/);
});

test('generateAppleScript escapes JSON response values through AppleScript helper', () => {
  const script = generateAppleScript({
    name: "Review client's \\ draft"
  });

  assert.match(script, /on jsonEscape\(inputText\)/);
  assert.match(script, /set taskNameValue to name of newTask/);
  assert.match(script, /my jsonEscape\(taskId\)/);
  assert.match(script, /my jsonEscape\(taskNameValue\)/);
});
