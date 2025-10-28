import { GatewayServer, LocalServer } from './core/gateway.js';
import { UpsunMcpServer } from './mcpUpsun.js';
import { initTelemetry, shutdownTelemetry } from './core/telemetry.js';
import { getConfigSummary, appConfig } from './core/config.js';
import { createLogger } from './core/logger.js';
import { McpType } from './core/types.js';

const log = createLogger('main');

// Initialize OpenTelemetry before starting the server
await initTelemetry();

// Log configuration on startup
log.info('Starting Upsun MCP Server...');
log.debug(getConfigSummary());

// Handle graceful shutdown
const cleanup = async (): Promise<void> => {
  log.info('Shutting down gracefully...');
  await shutdownTelemetry();
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
  const srv = new GatewayServer(UpsunMcpServer);
  await srv.listen(PORT);
  log.info(`Gateway server started on port ${PORT}`);
}
