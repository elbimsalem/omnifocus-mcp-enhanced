#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import tool definitions
import * as dumpDatabaseTool from './tools/definitions/dumpDatabase.js';
import * as addOmniFocusTaskTool from './tools/definitions/addOmniFocusTask.js';
import * as addProjectTool from './tools/definitions/addProject.js';
import * as removeItemTool from './tools/definitions/removeItem.js';
import * as editItemTool from './tools/definitions/editItem.js';
import * as moveTaskTool from './tools/definitions/moveTask.js';
import * as batchAddItemsTool from './tools/definitions/batchAddItems.js';
import * as batchRemoveItemsTool from './tools/definitions/batchRemoveItems.js';
import * as batchEditItemsTool from './tools/definitions/batchEditItems.js';
import * as manageTagTool from './tools/definitions/manageTag.js';
import * as manageFolderTool from './tools/definitions/manageFolder.js';
import * as syncDatabaseTool from './tools/definitions/syncDatabase.js';
import * as getTaskByIdTool from './tools/definitions/getTaskById.js';
import * as batchGetTasksTool from './tools/definitions/batchGetTasks.js';
import * as readTaskAttachmentTool from './tools/definitions/readTaskAttachment.js';
import * as getTodayCompletedTasksTool from './tools/definitions/getTodayCompletedTasks.js';
// Import perspective tools
import * as getInboxTasksTool from './tools/definitions/getInboxTasks.js';
import * as getFlaggedTasksTool from './tools/definitions/getFlaggedTasks.js';
import * as getForecastTasksTool from './tools/definitions/getForecastTasks.js';
import * as getTasksByTagTool from './tools/definitions/getTasksByTag.js';
// Import ultimate filter tool
import * as filterTasksTool from './tools/definitions/filterTasks.js';
// Import custom perspective tools
import * as listCustomPerspectivesTool from './tools/definitions/listCustomPerspectives.js';
import * as getCustomPerspectiveTasksTool from './tools/definitions/getCustomPerspectiveTasks.js';

// Create an MCP server
const server = new McpServer({
  name: "OmniFocus MCP",
  version: "1.6.9"
});

// Register tools
server.tool(
  "dump_database",
  "Gets the current state of your OmniFocus database",
  dumpDatabaseTool.schema.shape,
  dumpDatabaseTool.handler
);

server.tool(
  "add_omnifocus_task",
  "Add a new task to OmniFocus",
  addOmniFocusTaskTool.schema.shape,
  addOmniFocusTaskTool.handler
);

server.tool(
  "add_project",
  "Add a new project to OmniFocus",
  addProjectTool.schema.shape,
  addProjectTool.handler
);

server.tool(
  "remove_item",
  "Remove a task or project from OmniFocus",
  removeItemTool.schema.shape,
  removeItemTool.handler
);

server.tool(
  "edit_item",
  "Edit a task or project in OmniFocus",
  editItemTool.schema.shape,
  editItemTool.handler
);

server.tool(
  "move_task",
  "Move an existing task to a project, parent task, or inbox",
  moveTaskTool.schema.shape,
  moveTaskTool.handler
);

server.tool(
  "batch_add_items",
  "Add multiple tasks or projects to OmniFocus in a single operation",
  batchAddItemsTool.schema.shape,
  batchAddItemsTool.handler
);

server.tool(
  "batch_remove_items",
  "Remove multiple tasks or projects from OmniFocus in a single operation",
  batchRemoveItemsTool.schema.shape,
  batchRemoveItemsTool.handler
);

server.tool(
  "batch_edit_items",
  "Apply tag/flag/date/status edits to many tasks or projects in a single OmniFocus pass. Provide `ids` + a shared edit (tags/flagged/newPlannedDate/newDueDate/newDeferDate/newEstimatedMinutes/newStatus), or `operations` for per-item edits (e.g. a different planned date per task). Collapses a whole reconcile-apply into one call.",
  batchEditItemsTool.schema.shape,
  batchEditItemsTool.handler
);

server.tool(
  "manage_tag",
  "Create (optionally nested under a parent), rename, reparent, or delete a tag DEFINITION — structural tag ops edit_item can't do.",
  manageTagTool.schema.shape,
  manageTagTool.handler
);

server.tool(
  "manage_folder",
  "Create (optionally nested), rename (e.g. FINCANES → FINANCES), or delete a folder.",
  manageFolderTool.schema.shape,
  manageFolderTool.handler
);

server.tool(
  "sync_database",
  "Trigger an OmniFocus database sync against the configured sync server (e.g. after a batch of writes).",
  syncDatabaseTool.schema.shape,
  syncDatabaseTool.handler
);


server.tool(
  "get_task_by_id",
  "Get information about a specific task by ID or name",
  getTaskByIdTool.schema.shape,
  getTaskByIdTool.handler
);

server.tool(
  "batch_get_tasks",
  "Read many tasks by id in ONE OmniFocus pass (read counterpart to batch_edit_items). Returns JSON with full date/tag/project state per id; dates are local-offset ISO. Built for the reverse-sync/reconcile + hydrate flow — far faster than one get_task_by_id per id.",
  batchGetTasksTool.schema.shape,
  batchGetTasksTool.handler
);

server.tool(
  "read_task_attachment",
  "Read a task attachment reported by get_task_by_id. Images are returned as MCP image content when possible.",
  readTaskAttachmentTool.schema.shape,
  readTaskAttachmentTool.handler
);

server.tool(
  "get_today_completed_tasks",
  "Get tasks completed today - view today's accomplishments",
  getTodayCompletedTasksTool.schema.shape,
  getTodayCompletedTasksTool.handler
);

// Register perspective tools
server.tool(
  "get_inbox_tasks",
  "Get tasks from OmniFocus inbox perspective",
  getInboxTasksTool.schema.shape,
  getInboxTasksTool.handler
);

server.tool(
  "get_flagged_tasks", 
  "Get flagged tasks from OmniFocus with optional project filtering",
  getFlaggedTasksTool.schema.shape,
  getFlaggedTasksTool.handler
);

server.tool(
  "get_forecast_tasks",
  "Get tasks from OmniFocus forecast perspective (due/deferred tasks in date range)", 
  getForecastTasksTool.schema.shape,
  getForecastTasksTool.handler
);

server.tool(
  "get_tasks_by_tag",
  "Get tasks filtered by OmniFocus tags (labels like @home, @work, @urgent). Use this for tag-based filtering, NOT for custom perspective names. Tags are labels assigned to individual tasks.",
  getTasksByTagTool.schema.shape, 
  getTasksByTagTool.handler
);

// Ultimate filter tool - The most powerful task perspective engine
server.tool(
  "filter_tasks",
  "Advanced task filtering with unlimited perspective combinations - status, dates, projects, tags, search, and more",
  filterTasksTool.schema.shape,
  filterTasksTool.handler
);

// Custom perspective tools
server.tool(
  "list_custom_perspectives",
  "List all custom perspectives defined in OmniFocus",
  listCustomPerspectivesTool.schema.shape,
  listCustomPerspectivesTool.handler
);

server.tool(
  "get_custom_perspective_tasks",
  "Get tasks from a specific OmniFocus custom perspective by name. Use this when user refers to perspective names like '今日工作安排', '今日复盘', '本周项目' etc. - these are custom views created in OmniFocus, NOT tags. Supports hierarchical tree display of task relationships.",
  getCustomPerspectiveTasksTool.schema.shape,
  getCustomPerspectiveTasksTool.handler
);

// Start the MCP server
const transport = new StdioServerTransport();

// Use await with server.connect to ensure proper connection
(async function() {
  try {
    await server.connect(transport);
  } catch (err) {
    console.error(`Failed to start MCP server: ${err}`);
  }
})();

// For a cleaner shutdown if the process is terminated
