import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: [
    '**/test/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',  // Exclure le fichier d'entrée principal
    '!src/**/*.types.ts', // Exclure les fichiers de types
    '!src/**/*.interface.ts', // Exclure les interfaces
  ],
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json-summary',
    'cobertura' // Pour une meilleure intégration CI
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Seuils spécifiques par dossier
    './src/core/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/command/': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  // Configuration pour les rapports détaillés
  verbose: true,
  collectCoverage: false, // Par défaut false, activé via --coverage
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/coverage/',
    '\\.d\\.ts$'
  ]
};

// Utiliser export default au lieu de module.exports pour les modules ESM
export default config;
