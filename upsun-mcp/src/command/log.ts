/**
 * @fileoverview Log command module for Upsun MCP server.
 *
 * This module provides MCP tools that read the logs of an environment through
 * the Observability API: a severity overview and a paginated log query.
 */

import {
  LogsApi,
  LogsOverviewRequest,
  LogsQueryLogKindsEnum,
  LogsQueryOrderEnum,
  LogsQuerySeveritiesEnum,
  LogsQuerySeveritiesModeEnum,
} from 'upsun-sdk-node';
import { z } from 'zod';
import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { lean } from '../core/lean.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('MCP:Tool:log-commands');

const FILTER_HELP =
  'Each list filter has a `<name>_mode`: "1" includes only the listed values, "-1" excludes them. The default is "-1" (exclude).';

function filterMode(name: string): z.ZodOptional<z.ZodEnum<typeof LogsQuerySeveritiesModeEnum>> {
  return z
    .enum(LogsQuerySeveritiesModeEnum)
    .optional()
    .describe(`"1" includes only the listed ${name}, "-1" excludes them. Default: "-1".`);
}

function stringFilter(description: string): z.ZodOptional<z.ZodArray<z.ZodString>> {
  return z.array(z.string()).optional().describe(description);
}

const logFilterShape = {
  project_id: Schema.projectId(),
  environment_name: Schema.environmentName(),
  from: z.number().int().describe('Start of the time range, as a Unix timestamp in seconds.'),
  to: z.number().int().describe('End of the time range, as a Unix timestamp in seconds.'),
  severities: z.array(z.enum(LogsQuerySeveritiesEnum)).optional(),
  severities_mode: filterMode('severities'),
  services: stringFilter('Service names.'),
  services_mode: filterMode('services'),
  instances: stringFilter('Instance names.'),
  instances_mode: filterMode('instances'),
  hosts: stringFilter('Host names.'),
  hosts_mode: filterMode('hosts'),
  commands: stringFilter('Command names.'),
  commands_mode: filterMode('commands'),
  units: stringFilter('Unit names.'),
  units_mode: filterMode('units'),
  container_ids: stringFilter('Container IDs.'),
  container_ids_mode: filterMode('container IDs'),
  container_images: stringFilter('Container images.'),
  container_images_mode: filterMode('container images'),
  log_kinds: z
    .array(z.enum(LogsQueryLogKindsEnum))
    .optional()
    .describe('Log kinds. When not set, the API returns only "application" logs.'),
  log_kinds_mode: filterMode('log kinds'),
  full: Schema.full(),
};

type LogFilterInput = z.infer<z.ZodObject<typeof logFilterShape>>;

function toSdkRequest(input: LogFilterInput): LogsOverviewRequest {
  return {
    projectId: input.project_id,
    environmentId: input.environment_name,
    from: input.from,
    to: input.to,
    severities: input.severities,
    severitiesMode: input.severities_mode,
    services: input.services,
    servicesMode: input.services_mode,
    instances: input.instances,
    instancesMode: input.instances_mode,
    hosts: input.hosts,
    hostsMode: input.hosts_mode,
    commands: input.commands,
    commandsMode: input.commands_mode,
    units: input.units,
    unitsMode: input.units_mode,
    containerIds: input.container_ids,
    containerIdsMode: input.container_ids_mode,
    containerImages: input.container_images,
    containerImagesMode: input.container_images_mode,
    logKinds: input.log_kinds,
    logKindsMode: input.log_kinds_mode,
  };
}

/**
 * Registers the log tools with the MCP server:
 * - get-environment-log-overview: severity counts per time slot of an environment
 * - query-environment-log: log entries of an environment, 100 per page
 *
 * @param adapter - The MCP adapter instance to register tools with
 */
export function registerLog(adapter: McpAdapter): void {
  log.info('Register Log Handlers');

  adapter.server.registerTool(
    'get-environment-log-overview',
    {
      annotations: { readOnlyHint: true },
      description:
        'Get the log severity counts per time slot of an environment, and the values that each filter accepts. ' +
        FILTER_HELP,
      inputSchema: logFilterShape,
    },
    ToolWrapper.trace('get-environment-log-overview', async input => {
      log.debug(
        `Get Log Overview of Environment ${input.environment_name} in Project ${input.project_id}`
      );
      // The Raw response keeps the API keys; the plain method renames them.
      const response = await new LogsApi(adapter.client.apiConfig).logsOverviewRaw(
        toSdkRequest(input)
      );
      const result = await response.raw.json();

      return Response.json(input.full ? result : lean(result, { itemsKey: 'data' }));
    })
  );

  adapter.server.registerTool(
    'query-environment-log',
    {
      annotations: { readOnlyHint: true },
      description:
        'Get the log entries of an environment. Each page has 100 entries. ' +
        'When `_has_more_results` is true, pass `_cursor` as `cursor` to get the next page. ' +
        FILTER_HELP,
      inputSchema: {
        ...logFilterShape,
        cursor: z
          .string()
          .optional()
          .describe('Cursor of the next page: the `_cursor` value of the previous response.'),
        order: z
          .enum(LogsQueryOrderEnum)
          .optional()
          .describe('"DESC" (newest first) or "ASC". Default: "DESC".'),
      },
    },
    ToolWrapper.trace('query-environment-log', async input => {
      log.debug(
        `Query Logs of Environment ${input.environment_name} in Project ${input.project_id}`
      );
      const response = await new LogsApi(adapter.client.apiConfig).logsQueryRaw({
        ...toSdkRequest(input),
        cursor: input.cursor,
        order: input.order,
      });
      const result = await response.raw.json();

      return Response.json(input.full ? result : lean(result, { itemsKey: 'data' }));
    })
  );
}
