import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";


export function registerBackup(adapter: McpAdapter): void {
  console.log(`Register Backup Handlers`);

  adapter.server.tool(
    "create-backup",
    "Create a backup on upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      is_live: z.boolean().default(true).optional(),
    },
    async ({ project_id, environment_name, is_live }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "delete-backup",
    "Delete a backup of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      backup_id: Schema.backupId(),
    },
    async ({ project_id, environment_name, backup_id }) => {
      const result = "TODO"; //await adapter.client.backup.delete(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "get-backup",
    "Get a backup of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      backup_id: Schema.backupId(),
    },
    async ({ project_id, environment_name, backup_id }) => {
      const result = "TODO"; //await adapter.client.backup.delete(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-backup",
    "List all backups of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = "TODO"; //await adapter.client.backup.list(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "restore-backup",
    "Restore a backups of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      target_environment_name: Schema.environmentName(),
      no_code: z.boolean().default(false).optional(),
      no_resources: z.boolean().default(false).optional(),
      resources_init: z.string().default("backup").optional(),
    },
    async ({ project_id, environment_name, target_environment_name, no_code, no_resources, resources_init }) => {
      const result = "TODO"; //await adapter.client.backup.list(project_id, environment_name);

      return Response.json(result);
    }
  );

}
