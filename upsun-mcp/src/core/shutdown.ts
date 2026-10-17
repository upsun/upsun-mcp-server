import { createLogger } from './logger.js';

const log = createLogger('main');

const SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * Builds the SIGTERM/SIGINT handler. Upsun sends SIGTERM on deploy and stop; SIGINT is a local Ctrl-C.
 *
 * @param flush - Work to finish before exiting, e.g. flushing telemetry
 * @param timeoutMs - Time after which the process exits 1 regardless
 */
export function createShutdownHandler(
  flush: () => Promise<void>,
  timeoutMs: number = SHUTDOWN_TIMEOUT_MS
): () => Promise<void> {
  let shuttingDown = false;
  return async () => {
    // Repeated signals are ignored: one Ctrl-C under npm/npx can deliver SIGINT twice.
    if (shuttingDown) return;
    shuttingDown = true;
    // Bound the flush so a stalled exporter cannot hold the process until SIGKILL.
    setTimeout(() => {
      log.warn('Shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs).unref();
    log.info('Shutting down gracefully...');
    // Without this, a rejection from flush() would skip the exit.
    try {
      await flush();
    } catch (error) {
      log.error('Shutdown flush failed:', error);
    }
    process.exit(0);
  };
}
