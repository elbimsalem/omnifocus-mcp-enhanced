import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMoveProjectsOmniJs } from './moveProjects.js';
import { normalizeOperations } from './batchEditItems.js';
import { schema as batchEditSchema } from '../definitions/batchEditItems.js';
import { schema as editItemSchema } from '../definitions/editItem.js';

test('buildMoveProjectsOmniJs reparents into a named folder via moveSections', () => {
  const body = buildMoveProjectsOmniJs([{ id: 'proj-1', folderName: 'AREAS' }]);
  assert.match(body, /moveSections\(\[proj\], dest\)/);
  assert.match(body, /folder\.ending/);
  assert.match(body, /Project\.byIdentifier/);
  // The destination folder name is embedded as data.
  assert.match(body, /"folderName":"AREAS"/);
});

test('buildMoveProjectsOmniJs routes null/empty folder to the library root', () => {
  const body = buildMoveProjectsOmniJs([{ id: 'proj-1', folderName: null }]);
  assert.match(body, /library\.ending/);
  assert.match(body, /'\(root\)'/);
});

test('buildMoveProjectsOmniJs is batch-native (multiple moves in one body)', () => {
  const body = buildMoveProjectsOmniJs([
    { id: 'a', folderName: 'AREAS' },
    { id: 'b', folderName: 'BUSINESS' },
    { id: 'c', folderName: null }
  ]);
  assert.match(body, /"id":"a"/);
  assert.match(body, /"id":"b"/);
  assert.match(body, /"id":"c"/);
});

test('normalizeOperations carries newFolderName from shared mode', () => {
  const ops = normalizeOperations({ ids: ['p1', 'p2'], newFolderName: 'AREAS' });
  assert.equal(ops.length, 2);
  assert.equal(ops[0].newFolderName, 'AREAS');
  assert.equal(ops[1].newFolderName, 'AREAS');
});

test('normalizeOperations preserves per-op newFolderName', () => {
  const ops = normalizeOperations({
    operations: [
      { id: 'p1', newFolderName: 'AREAS' },
      { id: 'p2', newFolderName: '' }
    ]
  });
  assert.equal(ops[0].newFolderName, 'AREAS');
  assert.equal(ops[1].newFolderName, '');
});

test('batch_edit_items schema accepts newFolderName (shared + per-op)', () => {
  const parsed = batchEditSchema.parse({
    ids: ['p1'],
    newFolderName: 'AREAS'
  }) as any;
  assert.equal(parsed.newFolderName, 'AREAS');

  const perOp = batchEditSchema.parse({
    operations: [{ id: 'p1', newFolderName: '' }]
  }) as any;
  assert.equal(perOp.operations[0].newFolderName, '');
});

test('edit_item schema accepts newFolderName including empty string for root', () => {
  const parsed = editItemSchema.parse({
    itemType: 'project',
    id: 'p1',
    newFolderName: ''
  }) as any;
  assert.equal(parsed.newFolderName, '');
});
