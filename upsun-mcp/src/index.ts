import { GatewayServer } from './core/gateway.js';
import { UpsunMcpServer } from './mcpUpsun.js';
import { initTelemetry, shutdownTelemetry } from './core/telemetry.js';
import { getConfigSummary, appConfig } from './core/config.js';
import { createLogger } from './core/logger.js';
import { createShutdownHandler } from './core/shutdown.js';

const log = createLogger('main');

// Initialize OpenTelemetry before starting the server.
// initTelemetry() handles errors internally and never throws.
await initTelemetry();

// Log configuration on startup
log.info('Starting Upsun MCP Server...');
log.debug(getConfigSummary());

// Handle graceful shutdown.
const cleanup = createShutdownHandler(shutdownTelemetry);

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the Streamable HTTP server.
const PORT = appConfig.port;
const srv = new GatewayServer(UpsunMcpServer);
await srv.listen(PORT);
log.info(`Gateway server started on port ${PORT}`);
