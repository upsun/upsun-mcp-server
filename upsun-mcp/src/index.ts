import { GatewayServer, LocalServer } from './core/gateway.js';
import { UpsunMcpServer } from './mcpUpsun.js';
import { initTelemetry, shutdownTelemetry } from './core/telemetry.js';
import { getConfigSummary, appConfig } from './core/config.js';
import { createLogger } from './core/logger.js';
import { McpType } from './core/types.js';

const log = createLogger('main');

// Initialize OpenTelemetry before starting the server.
// initTelemetry() handles errors internally and never throws.
await initTelemetry();

// Log configuration on startup
log.info('Starting Upsun MCP Server...');
log.debug(getConfigSummary());

// Set below in remote mode. Holds the transport sessions the shutdown path drains.
let gateway: GatewayServer<UpsunMcpServer> | undefined;

// Handle graceful shutdown. Upsun sends SIGTERM on deploy and on stop; SIGINT
// comes from a local Ctrl-C. Both run this one path, so sessions close before
// telemetry flushes and the process exits once.
// Each step is guarded on its own: a throw must not skip the next step or the exit.
const cleanup = async (): Promise<void> => {
  log.info('Shutting down gracefully...');
  try {
    await gateway?.shutdown();
  } catch (error) {
    log.error('Failed to close transport sessions:', error);
  }
  try {
    await shutdownTelemetry();
  } catch (error) {
    log.error('Failed to shut down telemetry:', error);
  }
  log.info('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Main server startup logic
if (appConfig.typeEnv === McpType.LOCAL) {
  // STDIO
  const local = new LocalServer(UpsunMcpServer);
  await local.listen();
  log.info('Local server (stdio) started successfully');
} else {
  // SSE & Streamable
  const PORT = appConfig.port;
  gateway = new GatewayServer(UpsunMcpServer);
  await gateway.listen(PORT);
  log.info(`Gateway server started on port ${PORT}`);
}
