import dotenv from 'dotenv';

import { GatewayServer, LocalServer } from './core/gateway.js';
import { UpsunMcpServer } from './mcpUpsun.js';
import { initTelemetry, shutdownTelemetry } from './core/telemetry.js';
import { getConfigSummary } from './core/config.js';
import { createLogger } from './core/logger.js';

dotenv.config();

const log = createLogger('main');

// Initialize OpenTelemetry before starting the server
await initTelemetry();

// Log configuration on startup
log.info('Starting Upsun MCP Server...');
log.debug(getConfigSummary());

const typeInstance = process.env.TYPE_ENV || 'remote';

// Handle graceful shutdown
const cleanup = async (): Promise<void> => {
  log.info('Shutting down gracefully...');
  await shutdownTelemetry();
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

if (typeInstance === 'local') {
  // STDIO
  const local = new LocalServer(UpsunMcpServer);
  await local.listen();
  log.info('Local server (stdio) started successfully');
} else {
  // SSE & Streamable
  const PORT = Number(String(process.env.PORT)) || 3000;
  const srv = new GatewayServer(UpsunMcpServer);
  await srv.listen(PORT);
  log.info(`Gateway server started on port ${PORT}`);
}
