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
      branches: 50,
      functions: 80,
      lines: 70,
      statements: 70,
    },
    // Specific thresholds per folder - adjusted according to real metrics
    './src/core/': {
      branches: 55,
      functions: 60,
      lines: 50,
      statements: 50,
    },
    './src/command/': {
      branches: 60,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  // Configuration for detailed reports
  verbose: true,
  collectCoverage: false, // Default false, enabled via --coverage
  coveragePathIgnorePatterns: ['/node_modules/', '/build/', '/coverage/', '\\.d\\.ts$'],
};

// Use export default instead of module.exports for ESM modules
export default config;
