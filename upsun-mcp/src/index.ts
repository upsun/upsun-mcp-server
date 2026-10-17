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

// Handle graceful shutdown. Upsun sends SIGTERM on deploy and stop; SIGINT is a local Ctrl-C.
const SHUTDOWN_TIMEOUT_MS = 5000;
let shuttingDown = false;
const cleanup = async (): Promise<void> => {
  // Repeated signals are ignored: one Ctrl-C under npm/npx can deliver SIGINT twice.
  if (shuttingDown) return;
  shuttingDown = true;
  // Bound the flush so a stalled exporter cannot hold the process until SIGKILL.
  setTimeout(() => {
    log.warn('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  log.info('Shutting down gracefully...');
  // shutdownTelemetry() rethrows; without this the rejection skips the exit.
  try {
    await shutdownTelemetry();
  } catch (error) {
    log.error('Failed to shut down telemetry:', error);
  }
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
  // Streamable HTTP
  const PORT = appConfig.port;
  const srv = new GatewayServer(UpsunMcpServer);
  await srv.listen(PORT);
  log.info(`Gateway server started on port ${PORT}`);
}
