import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";


export function registerSshKey(adapter: McpAdapter): void {
  console.log(`Register SSH keys Handlers`);

  adapter.server.tool(
    "add-sshkey",
    "Add a SSH key on upsun account",
    {
      user_id: z.string(),
      ssh_key: z.string(),
      key_id: z.string(),
    },
    async ({ user_id, ssh_key, key_id }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "delete-sshkey",
    "Delete a SSH key of upsun account",
    {
      user_id: z.string(),
      key_id: z.string(),
    },
    async ({ user_id, key_id }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-sshkey",
    "List all SSH keys of upsun account",
    {
      user_id: z.string(),
    },
    async ({ user_id }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

}
