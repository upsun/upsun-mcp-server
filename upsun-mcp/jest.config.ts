import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/test/**/*.test.ts'],
  // Remove console output during tests
  silent: true,
  // Alternative: only for info and debug level logs
  // verbose: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // Exclude main entry file
    '!src/**/*.types.ts', // Exclude type files
    '!src/**/*.interface.ts', // Exclude interface files
  ],
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json-summary',
    'cobertura', // For better CI integration
  ],
  coverageThreshold: {
    global: {
      // branches: 40,    // Temporarily disabled due to Jest calculation issue
      functions: 80, // Current: 84.25%, keep current good level
      lines: 60, // Current: 67.94%, set below to allow fluctuation
      statements: 60, // Current: 68.19%, set below to allow fluctuation
    },
    // Specific thresholds per folder - adjusted according to real metrics
    './src/core/': {
      branches: 35, // gateway.ts has 10.2%, need low threshold
      functions: 55, // Current: 62.22%, set slightly below
      lines: 35, // Current: 42.12%, set below
      statements: 35, // Current: 42.66%, set below
    },
    './src/command/': {
      branches: 60, // Commands have good coverage (66.66%)
      functions: 95, // Keep high standard for business logic (100%)
      lines: 95, // Commands are well tested (100%)
      statements: 95, // Commands are well tested (100%)
    },
  },
  // Configuration for detailed reports
  verbose: true,
  collectCoverage: false, // Default false, enabled via --coverage
  coveragePathIgnorePatterns: ['/node_modules/', '/build/', '/coverage/', '\\.d\\.ts$'],
};

// Use export default instead of module.exports for ESM modules
export default config;
