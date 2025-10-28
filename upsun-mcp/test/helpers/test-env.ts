/**
 * Test environment helpers to ensure test isolation
 * and prevent side effects from .env files
 */

/**
 * Creates a clean environment object for tests
 * Only preserves essential Node.js variables
 */
export function getCleanTestEnv(originalEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    NODE_OPTIONS: originalEnv.NODE_OPTIONS,
    PATH: originalEnv.PATH,
    HOME: originalEnv.HOME,
    SKIP_DOTENV_LOAD: 'true', // Prevent .env loading during tests
  };
}

/**
 * Setup function to be called in beforeEach for test isolation
 * Clears module cache and resets environment
 */
export function setupTestEnvironment(
  jest: any,
  originalEnv: NodeJS.ProcessEnv = process.env
): void {
  jest.resetModules();
  process.env = getCleanTestEnv(originalEnv);
}

/**
 * Teardown function to be called in afterEach
 * Restores original environment
 */
export function teardownTestEnvironment(originalEnv: NodeJS.ProcessEnv): void {
  process.env = originalEnv;
}
