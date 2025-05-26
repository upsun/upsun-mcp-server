import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";


export function registerActivity(adapter: McpAdapter): void {
  console.log(`Register Activity Handlers`);

  adapter.server.tool(
    "cancel-activity",
    "Cancel a activity of upsun project",
    {
      project_id: Schema.projectId(),
      activity_id: Schema.activityId(),
    },
    async ({ project_id, activity_id }) => {
      const result = await adapter.client.activity.cancel(project_id, activity_id);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "get-activity",
    "Get detail of activity on upsun project",
    {
      project_id: Schema.projectId(),
      activity_id: Schema.activityId(),
    },
    async ({ project_id, activity_id }) => {
      const result = await adapter.client.activity.get(project_id, activity_id);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-activity",
    "List all activities of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = await adapter.client.activity.list(project_id);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "log-activity",
    "Get log activity of upsun project",
    {
      project_id: Schema.projectId(),
      activity_id: Schema.activityId(),
    },
    async ({ project_id, activity_id }) => {
      const result = await adapter.client.activity.log(project_id, activity_id);

      return Response.json(result);
    }
  );
}
