import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";


export function registerEnvironment(adapter: McpAdapter): void {  // , cliProvider: Client
  console.log(`Register Environment Handlers`);

  adapter.server.tool(
    "activate-environment",
    "Activate a environment of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.activate(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "delete-environment",
    "Delete a environment of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.delete(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "info-environment",
    "Get information of environment on upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.info(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-environment",
    "List all environments of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = await adapter.client.environment.list(project_id);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "logs-environment",
    "Display logs of app of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      application_name: Schema.applicationName(),
    },
    async ({ project_id }) => {
      const result = { throw: "Not implemented !" };

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "merge-environment",
    "Merge a environment to parent environment of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.merge(project_id, environment_name);

      return Response.json(result);
    }
  )

  adapter.server.tool(
    "pause-environment",
    "Pause a environment of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.pause(project_id, environment_name);

      return Response.json(result);
    }
  )

  adapter.server.tool(
    "redeploy-environment",
    "Redeploy a environment of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      application_name: Schema.applicationName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.redeploy(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "resume-environment",
    "Resume a environment of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.resume(project_id, environment_name);

      return Response.json(result);
    }
  )

  adapter.server.tool(
    "urls-environment",
    "Get URLs of environment on upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.environment.url(project_id, environment_name);

      return Response.json(result);
    }
  )

}
