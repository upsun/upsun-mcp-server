import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";

export function registerConfig(adapter: McpAdapter): void {
  console.log(`Register Backup Handlers`);

  adapter.server.prompt(
    "generate-config",
    "Create a configuration for upsun project",
    { app_name: z.string() },
    async ({ app_name }) => {
      const result = 
`Make this tasks (add headers at all steps):
1. update .upsun/config.yaml file with content:
\`\`\`yaml
### Fake ###
applications:
  ${app_name}:
    # configuration for the application '${app_name}'
    type: "nodejs:20"
    source:
      root: "/"

services:

routes:
  'https://{default}/':
    type: upstream
    upstream: "${app_name}:http"
\`\`\`
2. Validate the .upsun/config.yaml file
3. Add and commit the .upsun/config.yaml file on reporitory (without any other file/folder)
4. And push them on upsun remote`;

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: result
          }
        }]
      }
    }
  );

  adapter.server.prompt(
    "init-config",
    "Initialize a upsun project",
    {
      app_name: z.string(),
      domain_host: z.string()
    },
    async ({ app_name, domain_host }) => {
      const result = 
`Make this tasks (add headers at all steps):
1. Create upsun project (check default branch name of current project).
2. Create .upsun/config.yaml file with content:
\`\`\`yaml
### Fake call to AI-onboarding - Demo templating ###
applications:
  ${app_name}:
    # configuration for the application '${app_name}'

services:

routes:
  'https://{default}/':
    type: upstream
    upstream: "${app_name}:http"
\`\`\`
3. Validate the .upsun/config.yaml file
4. Check if projet is git init.
5. Add and commit the .upsun/config.yaml file on reporitory (without any other file/folder)
6. And push them on upsun remote (check remote url on project info)
7. Check last activity of upsun project to know the status of deployement
8. Add domain '${domain_host}' to the project`;

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: result
          }
        }]
      }
    }
  );

  adapter.server.prompt(
    "add-domain",
    "Add a new domain to upsun project",
    { domain_host: z.string() },
    async ({ domain_host }) => {
      const result = 
`Make this tasks (add headers at all steps):
1. Create domain "${domain_host}" to the upsun project.
2. Check if project is online with domain "${domain_host}".`;

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: result
          }
        }]
      }
    }
  );

  adapter.server.prompt(
    "add-variable",
    "Add a new domain to upsun project",
    {
      variable_name: z.string(),
      variable_value: z.string(),
      variable_sensitive: z.string()
    },
    async ({ variable_name, variable_value, variable_sensitive }) => {
      const result = 
`Make this tasks (add headers at all steps):
1. Create variable "${variable_name}" to the upsun project. with value "${variable_value}" and sensitive ${variable_sensitive}.
2. `;

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: result
          }
        }]
      }
    }
  );
}
