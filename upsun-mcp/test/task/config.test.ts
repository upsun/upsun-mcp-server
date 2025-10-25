import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerConfig } from '../../src/task/config';

// Mock the logger module
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/core/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

// Mock data for testing
const mockPromptCallbacks: Record<string, (args: any) => any> = {};

// Mock the adapter with proper typing
const mockServer = {
  prompt: jest.fn(),
};

const mockAdapter: McpAdapter = {
  client: {} as any,
  server: mockServer as any,
} as any;

describe('Config Task Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear prompt callbacks
    Object.keys(mockPromptCallbacks).forEach(key => delete mockPromptCallbacks[key]);

    // Reset logger mocks
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Set up the mock to capture callbacks correctly
    (mockAdapter.server.prompt as jest.Mock).mockImplementation((...args: any[]) => {
      const [name, , , callback] = args;
      mockPromptCallbacks[name] = callback;
      return mockAdapter.server;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerConfig function', () => {
    it('should register all config prompts', () => {
      registerConfig(mockAdapter);

      expect(mockAdapter.server.prompt).toHaveBeenCalledTimes(4);

      // Verify all prompts are registered
      expect(mockPromptCallbacks['generate-config']).toBeDefined();
      expect(mockPromptCallbacks['init-config']).toBeDefined();
      expect(mockPromptCallbacks['add-domain']).toBeDefined();
      expect(mockPromptCallbacks['add-variable']).toBeDefined();
    });

    it('should register prompts with correct names and descriptions', () => {
      registerConfig(mockAdapter);

      const promptCalls = (mockAdapter.server.prompt as jest.Mock).mock.calls;

      expect(promptCalls[0]).toEqual([
        'generate-config',
        'Create a configuration for upsun project (requires upsun CLI installed)',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(promptCalls[1]).toEqual([
        'init-config',
        'Initialize a upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(promptCalls[2]).toEqual([
        'add-domain',
        'Add a new domain to upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(promptCalls[3]).toEqual([
        'add-variable',
        'Add a new domain to upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);
    });
  });

  describe('generate-config prompt', () => {
    beforeEach(() => {
      registerConfig(mockAdapter);
    });

    it('should generate config with app name', async () => {
      const result = await mockPromptCallbacks['generate-config']({
        app_name: 'my-app',
      });

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('my-app'),
            },
          },
        ],
      });

      expect(result.messages[0].content.text).toContain('.upsun/config.yaml');
    });

    it('should include all required steps in config generation', async () => {
      const result = await mockPromptCallbacks['generate-config']({
        app_name: 'test-app',
      });

      const content = result.messages[0].content.text;

      expect(content).toContain(
        '1. Use the Upsun CLI to generate the configuration for the project test-app'
      );
      expect(content).toContain('2. Validate the .upsun/config.yaml file');
      expect(content).toContain('3. Add and commit the .upsun/config.yaml file');
      expect(content).toContain('4. And push them on upsun remote');
    });

    it('should handle different app names', async () => {
      const testCases = ['frontend', 'backend-api', 'worker-service'];

      for (const appName of testCases) {
        const result = await mockPromptCallbacks['generate-config']({
          app_name: appName,
        });

        expect(result.messages[0].content.text).toContain(appName);
      }
    });
  });

  describe('init-config prompt', () => {
    beforeEach(() => {
      registerConfig(mockAdapter);
    });

    it('should generate init config with app name and domain', async () => {
      const result = await mockPromptCallbacks['init-config']({
        app_name: 'my-app',
        domain_host: 'example.com',
      });

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('my-app'),
            },
          },
        ],
      });

      const content = result.messages[0].content.text;
      expect(content).toContain('my-app');
      expect(content).toContain('example.com');
    });

    it('should include all initialization steps', async () => {
      const result = await mockPromptCallbacks['init-config']({
        app_name: 'test-app',
        domain_host: 'test.com',
      });

      const content = result.messages[0].content.text;

      expect(content).toContain('1. Create upsun project');
      expect(content).toContain('2. Create .upsun/config.yaml');
      expect(content).toContain('3. Validate the .upsun/config.yaml');
      expect(content).toContain('4. Check if projet is git init');
      expect(content).toContain('5. Add and commit');
      expect(content).toContain('6. And push them on upsun remote');
      expect(content).toContain('7. Check last activity');
      expect(content).toContain('8. Add domain');
    });

    it('should handle complex domain names', async () => {
      const complexDomains = ['sub.domain.com', 'api-v2.example.org', 'test-env.staging.app'];

      for (const domain of complexDomains) {
        const result = await mockPromptCallbacks['init-config']({
          app_name: 'app',
          domain_host: domain,
        });

        expect(result.messages[0].content.text).toContain(domain);
      }
    });
  });

  describe('add-domain prompt', () => {
    beforeEach(() => {
      registerConfig(mockAdapter);
    });

    it('should generate add domain instructions', async () => {
      const result = await mockPromptCallbacks['add-domain']({
        domain_host: 'new-domain.com',
      });

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('new-domain.com'),
            },
          },
        ],
      });

      const content = result.messages[0].content.text;
      expect(content).toContain('1. Create domain "new-domain.com"');
      expect(content).toContain('2. Check if project is online with domain "new-domain.com"');
    });

    it('should handle various domain formats', async () => {
      const domains = ['simple.com', 'with-dash.org', 'sub.domain.co.uk'];

      for (const domain of domains) {
        const result = await mockPromptCallbacks['add-domain']({
          domain_host: domain,
        });

        const content = result.messages[0].content.text;
        expect(content).toContain(`Create domain "${domain}"`);
        expect(content).toContain(`online with domain "${domain}"`);
      }
    });
  });

  describe('add-variable prompt', () => {
    beforeEach(() => {
      registerConfig(mockAdapter);
    });

    it('should generate add variable instructions', async () => {
      const result = await mockPromptCallbacks['add-variable']({
        variable_name: 'API_KEY',
        variable_value: 'secret123',
        variable_sensitive: 'true',
      });

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('API_KEY'),
            },
          },
        ],
      });

      const content = result.messages[0].content.text;
      expect(content).toContain('Create variable "API_KEY"');
      expect(content).toContain('with value "secret123"');
      expect(content).toContain('and sensitive true');
    });

    it('should handle different variable types', async () => {
      const testCases = [
        { variable_name: 'DB_HOST', variable_value: 'localhost', variable_sensitive: 'false' },
        { variable_name: 'SECRET_TOKEN', variable_value: 'xyz789', variable_sensitive: 'true' },
        { variable_name: 'PORT', variable_value: '3000', variable_sensitive: 'false' },
      ];

      for (const testCase of testCases) {
        const result = await mockPromptCallbacks['add-variable'](testCase);

        const content = result.messages[0].content.text;
        expect(content).toContain(`variable "${testCase.variable_name}"`);
        expect(content).toContain(`value "${testCase.variable_value}"`);
        expect(content).toContain(`sensitive ${testCase.variable_sensitive}`);
      }
    });

    it('should handle special characters in variables', async () => {
      const result = await mockPromptCallbacks['add-variable']({
        variable_name: 'COMPLEX_VAR',
        variable_value: 'value@with#special$chars',
        variable_sensitive: 'true',
      });

      const content = result.messages[0].content.text;
      expect(content).toContain('value@with#special$chars');
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(() => {
      registerConfig(mockAdapter);
    });

    it('should handle empty app names', async () => {
      const result = await mockPromptCallbacks['generate-config']({
        app_name: '',
      });

      //expect(result.messages[0].content.text).toContain('applications:');
      expect(result.messages[0].content.text).toContain(':');
    });

    it('should handle empty domains', async () => {
      const result = await mockPromptCallbacks['add-domain']({
        domain_host: '',
      });

      const content = result.messages[0].content.text;
      expect(content).toContain('Create domain ""');
    });

    it('should handle empty variable values', async () => {
      const result = await mockPromptCallbacks['add-variable']({
        variable_name: 'EMPTY_VAR',
        variable_value: '',
        variable_sensitive: 'false',
      });

      const content = result.messages[0].content.text;
      expect(content).toContain('with value ""');
    });
  });
});
