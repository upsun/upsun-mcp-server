import { describe, expect, it, jest } from '@jest/globals';
import {
  Schema,
  Assert,
  Response,
  ToolWrapper,
  isSensitiveParam,
  SENSITIVE_PARAM_KEYWORDS,
  forwardUpstream401,
  toSdkPagination,
} from '../../src/core/helper';
import { z } from 'zod';
import { ResponseError } from 'upsun-sdk-node/dist/core/runtime.js';
import { requestContext } from '../../src/core/requestContext';

describe('Helper Module', () => {
  describe('isSensitiveParam function', () => {
    it('should detect token-related parameters', () => {
      expect(isSensitiveParam('bearer_token')).toBe(true);
      expect(isSensitiveParam('access_token')).toBe(true);
      expect(isSensitiveParam('refresh_token')).toBe(true);
      expect(isSensitiveParam('myToken')).toBe(true);
    });

    it('should detect password-related parameters', () => {
      expect(isSensitiveParam('password')).toBe(true);
      expect(isSensitiveParam('user_password')).toBe(true);
      expect(isSensitiveParam('myPassword')).toBe(true);
    });

    it('should detect secret-related parameters', () => {
      expect(isSensitiveParam('client_secret')).toBe(true);
      expect(isSensitiveParam('api_secret')).toBe(true);
      expect(isSensitiveParam('mySecret')).toBe(true);
    });

    it('should detect key-related parameters', () => {
      expect(isSensitiveParam('api_key')).toBe(true);
      expect(isSensitiveParam('apikey')).toBe(true);
      expect(isSensitiveParam('private_key')).toBe(true);
      expect(isSensitiveParam('ssh_key')).toBe(true);
    });

    it('should detect auth and credential parameters', () => {
      expect(isSensitiveParam('authorization')).toBe(true);
      expect(isSensitiveParam('auth_token')).toBe(true);
      expect(isSensitiveParam('credentials')).toBe(true);
      expect(isSensitiveParam('user_credential')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isSensitiveParam('TOKEN')).toBe(true);
      expect(isSensitiveParam('PASSWORD')).toBe(true);
      expect(isSensitiveParam('Secret')).toBe(true);
      expect(isSensitiveParam('API_KEY')).toBe(true);
    });

    it('should not flag non-sensitive parameters', () => {
      expect(isSensitiveParam('project_id')).toBe(false);
      expect(isSensitiveParam('environment_name')).toBe(false);
      expect(isSensitiveParam('user_name')).toBe(false);
      expect(isSensitiveParam('organization_id')).toBe(false);
      expect(isSensitiveParam('backup_id')).toBe(false);
    });
  });

  describe('SENSITIVE_PARAM_KEYWORDS constant', () => {
    it('should contain expected sensitive keywords', () => {
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('token');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('password');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('secret');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('key');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('apikey');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('api_key');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('auth');
      expect(SENSITIVE_PARAM_KEYWORDS).toContain('credential');
    });

    it('should be a readonly array', () => {
      // TypeScript ensures this is readonly at compile time
      expect(Array.isArray(SENSITIVE_PARAM_KEYWORDS)).toBe(true);
    });
  });

  describe('Schema class', () => {
    describe('activityId', () => {
      it('should return a string schema for activity IDs', () => {
        const schema = Schema.activityId();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('test-activity-123')).toBe('test-activity-123');
      });

      it('should validate activity ID strings', () => {
        const schema = Schema.activityId();
        expect(() => schema.parse(123)).toThrow();
        expect(() => schema.parse(null)).toThrow();
        expect(() => schema.parse(undefined)).toThrow();
      });
    });

    describe('projectId', () => {
      it('should return a string schema with 13 character length requirement', () => {
        const schema = Schema.projectId();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('1234567890123')).toBe('1234567890123');
      });

      it('should reject project IDs not exactly 13 characters', () => {
        const schema = Schema.projectId();
        expect(() => schema.parse('123456789012')).toThrow('Project ID must be 13 characters long');
        expect(() => schema.parse('12345678901234')).toThrow(
          'Project ID must be 13 characters long'
        );
        expect(() => schema.parse('')).toThrow('Project ID must be 13 characters long');
      });
    });

    describe('environmentName', () => {
      it('should return a string schema for environment names', () => {
        const schema = Schema.environmentName();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('production')).toBe('production');
        expect(schema.parse('staging')).toBe('staging');
        expect(schema.parse('main')).toBe('main');
      });

      it('should validate environment name strings', () => {
        const schema = Schema.environmentName();
        expect(() => schema.parse(123)).toThrow();
        expect(() => schema.parse(null)).toThrow();
        expect(() => schema.parse(undefined)).toThrow();
      });
    });

    describe('applicationName', () => {
      it('should return a string schema for application names', () => {
        const schema = Schema.applicationName();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('my-app')).toBe('my-app');
        expect(schema.parse('backend-service')).toBe('backend-service');
      });

      it('should validate application name strings', () => {
        const schema = Schema.applicationName();
        expect(() => schema.parse(123)).toThrow();
        expect(() => schema.parse(null)).toThrow();
        expect(() => schema.parse(undefined)).toThrow();
      });
    });

    // describe('organizationId', () => {
    //   it('should return a string schema with 25 character length requirement', () => {
    //     const schema = Schema.organizationId();
    //     expect(schema).toBeInstanceOf(z.ZodString);
    //     expect(schema.parse('1234567890123456789012345')).toBe('1234567890123456789012345');
    //   });

    //   it('should reject organization IDs not exactly 25 characters', () => {
    //     const schema = Schema.organizationId();
    //     expect(() => schema.parse('123456789012345678901234567')).toThrow(
    //       'Organization ID must be 25 characters long'
    //     );
    //     expect(() => schema.parse('12345678901234567890123456')).toThrow(
    //       'Organization ID must be 25 characters long'
    //     );
    //     expect(() => schema.parse('')).toThrow('Organization ID must be 25 characters long');
    //   });
    // });

    describe('organizationName', () => {
      it('should return a string schema for organization names', () => {
        const schema = Schema.organizationName();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('My Organization')).toBe('My Organization');
        expect(schema.parse('ACME Corp')).toBe('ACME Corp');
      });

      it('should validate organization name strings', () => {
        const schema = Schema.organizationName();
        expect(() => schema.parse(123)).toThrow();
        expect(() => schema.parse(null)).toThrow();
        expect(() => schema.parse(undefined)).toThrow();
      });
    });

    describe('backupId', () => {
      it('should return a string schema with 27 character length requirement', () => {
        const schema = Schema.backupId();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('123456789012345678901234567')).toBe('123456789012345678901234567');
      });

      it('should reject backup IDs not exactly 27 characters', () => {
        const schema = Schema.backupId();
        expect(() => schema.parse('12345678901234567890123456')).toThrow(
          'Backup ID must be 27 characters long'
        );
        expect(() => schema.parse('1234567890123456789012345678')).toThrow(
          'Backup ID must be 27 characters long'
        );
        expect(() => schema.parse('')).toThrow('Backup ID must be 27 characters long');
      });
    });

    describe('certificateId', () => {
      it('should return a string schema with 65 character length requirement', () => {
        const schema = Schema.certificateId();
        expect(schema).toBeInstanceOf(z.ZodString);
        const validId = '1'.repeat(65);
        expect(schema.parse(validId)).toBe(validId);
      });

      it('should reject certificate IDs not exactly 65 characters', () => {
        const schema = Schema.certificateId();
        const shortId = '1'.repeat(64);
        const longId = '1'.repeat(66);
        expect(() => schema.parse(shortId)).toThrow('Certificate ID must be 65 characters long');
        expect(() => schema.parse(longId)).toThrow('Certificate ID must be 65 characters long');
        expect(() => schema.parse('')).toThrow('Certificate ID must be 65 characters long');
      });
    });

    describe('domainName', () => {
      it('should return a string schema with max 255 characters requirement', () => {
        const schema = Schema.domainName();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('example.com')).toBe('example.com');
        expect(schema.parse('subdomain.example.com')).toBe('subdomain.example.com');

        const maxLengthDomain = 'a'.repeat(255);
        expect(schema.parse(maxLengthDomain)).toBe(maxLengthDomain);
      });

      it('should reject domain names longer than 255 characters', () => {
        const schema = Schema.domainName();
        const tooLongDomain = 'a'.repeat(256);
        expect(() => schema.parse(tooLongDomain)).toThrow(
          'Domain name must be less than 255 characters'
        );
      });

      it('should validate domain name strings', () => {
        const schema = Schema.domainName();
        expect(() => schema.parse(123)).toThrow();
        expect(() => schema.parse(null)).toThrow();
        expect(() => schema.parse(undefined)).toThrow();
      });
    });

    describe('pagination', () => {
      it('should expose page_size and page_link as optional fields', () => {
        const fields = Schema.pagination();
        expect(fields.page_size.parse(undefined)).toBeUndefined();
        expect(fields.page_size.parse(50)).toBe(50);
        expect(
          fields.page_link.parse('/organizations/org-1/projects?page%5Bafter%5D=cursor-abc')
        ).toBe('/organizations/org-1/projects?page%5Bafter%5D=cursor-abc');
        expect(fields.page_link.parse(undefined)).toBeUndefined();
      });

      it('should reject non-positive or non-integer page_size values', () => {
        const fields = Schema.pagination();
        expect(() => fields.page_size.parse(0)).toThrow();
        expect(() => fields.page_size.parse(-1)).toThrow();
        expect(() => fields.page_size.parse(1.5)).toThrow();
      });

      it('should reject page_size values above the API maximum of 100', () => {
        const fields = Schema.pagination();
        expect(fields.page_size.parse(100)).toBe(100);
        expect(() => fields.page_size.parse(101)).toThrow();
      });
    });
  });

  describe('toSdkPagination', () => {
    it('sets page size for first page requests', () => {
      expect(toSdkPagination({ page_size: 25 })).toEqual({
        pageSize: 25,
        pageAfter: undefined,
        pageBefore: undefined,
      });
    });

    it('returns undefined for missing values', () => {
      expect(toSdkPagination({})).toEqual({
        pageSize: undefined,
        pageAfter: undefined,
        pageBefore: undefined,
      });
    });

    it('extracts pageAfter cursor from a full continuation link', () => {
      expect(
        toSdkPagination({
          page_link:
            'https://api.upsun.com/organizations/org-1/projects?pageAfter=cursor-xyz&pageSize=50',
        })
      ).toEqual({
        pageSize: 50,
        pageAfter: 'cursor-xyz',
        pageBefore: undefined,
      });
    });

    it('extracts page[after] cursor from an API next link', () => {
      expect(
        toSdkPagination({
          page_link:
            'https://api.upsun.com/organizations/org-1/projects?page%5Bafter%5D=cursor-xyz&page%5Bsize%5D=50',
        })
      ).toEqual({
        pageSize: 50,
        pageAfter: 'cursor-xyz',
        pageBefore: undefined,
      });
    });

    it('extracts pageBefore cursor from a relative continuation link', () => {
      expect(
        toSdkPagination({
          page_link: '/organizations/org-1/projects?pageBefore=cursor-prev',
        })
      ).toEqual({
        pageSize: undefined,
        pageAfter: undefined,
        pageBefore: 'cursor-prev',
      });
    });

    it('extracts page[size] from an API previous link', () => {
      expect(
        toSdkPagination({
          page_link: '/organizations/org-1/projects?page%5Bbefore%5D=cursor-prev&page%5Bsize%5D=25',
        })
      ).toEqual({
        pageSize: 25,
        pageAfter: undefined,
        pageBefore: 'cursor-prev',
      });
    });

    it('follows page_link exactly when page_size is also provided', () => {
      expect(
        toSdkPagination({
          page_size: 10,
          page_link: '/organizations/org-1/projects?page%5Bafter%5D=cursor-next&page%5Bsize%5D=25',
        })
      ).toEqual({
        pageSize: 25,
        pageAfter: 'cursor-next',
        pageBefore: undefined,
      });
    });

    it('extracts page[before] cursor from an API previous link', () => {
      expect(
        toSdkPagination({
          page_link: '/organizations/org-1/projects?page%5Bbefore%5D=cursor-prev',
        })
      ).toEqual({
        pageSize: undefined,
        pageAfter: undefined,
        pageBefore: 'cursor-prev',
      });
    });

    it('falls back to the original value when a URL has no cursor param', () => {
      expect(
        toSdkPagination({
          page_link: 'https://api.upsun.com/somewhere',
        })
      ).toEqual({
        pageSize: undefined,
        pageAfter: undefined,
        pageBefore: undefined,
      });
    });
  });

  describe('Assert class', () => {
    describe('projectId', () => {
      it('should validate project IDs', () => {
        expect(Assert.projectId('1234567890123')).toBe(true);
        expect(Assert.projectId('test-project')).toBe(true);
        expect(Assert.projectId('')).toBe(true);
        expect(Assert.projectId('invalid')).toBe(true);
      });

      it('should handle edge cases', () => {
        expect(Assert.projectId('')).toBe(true);
        expect(Assert.projectId('a')).toBe(true);
        expect(Assert.projectId('very-long-project-id-that-exceeds-normal-length')).toBe(true);
      });
    });

    describe('environmentName', () => {
      it('should validate environment names', () => {
        expect(Assert.environmentName('production')).toBe(true);
        expect(Assert.environmentName('staging')).toBe(true);
        expect(Assert.environmentName('main')).toBe(true);
        expect(Assert.environmentName('dev')).toBe(true);
      });

      it('should handle edge cases', () => {
        expect(Assert.environmentName('')).toBe(true);
        expect(Assert.environmentName('test-env')).toBe(true);
        expect(Assert.environmentName('environment-with-very-long-name')).toBe(true);
      });
    });
  });

  describe('Response class', () => {
    describe('text', () => {
      it('should create a text response with correct structure', () => {
        const result = Response.text('Hello World');

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: 'Hello World',
            },
          ],
        });
      });

      it('should handle empty strings', () => {
        const result = Response.text('');

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: '',
            },
          ],
        });
      });

      it('should handle multiline text', () => {
        const multilineText = 'Line 1\nLine 2\nLine 3';
        const result = Response.text(multilineText);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: multilineText,
            },
          ],
        });
      });

      it('should handle special characters', () => {
        const specialText = 'Special chars: !@#$%^&*()';
        const result = Response.text(specialText);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: specialText,
            },
          ],
        });
      });
    });

    describe('json', () => {
      it('should create a JSON response with correct structure', () => {
        const testObject = { name: 'Test', value: 123 };
        const result = Response.json(testObject);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(testObject, null, 2),
            },
          ],
        });
      });

      it('should handle arrays', () => {
        const testArray = [1, 2, 3, 'test'];
        const result = Response.json(testArray);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(testArray, null, 2),
            },
          ],
        });
      });

      it('should handle nested objects', () => {
        const nestedObject = {
          user: {
            name: 'John',
            details: {
              age: 30,
              preferences: ['coding', 'reading'],
            },
          },
        };
        const result = Response.json(nestedObject);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(nestedObject, null, 2),
            },
          ],
        });
      });

      it('should handle null and undefined', () => {
        expect(Response.json(null)).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(null, null, 2),
            },
          ],
        });

        expect(Response.json(undefined)).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(undefined, null, 2),
            },
          ],
        });
      });

      it('should handle primitive values', () => {
        expect(Response.json(42)).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(42, null, 2),
            },
          ],
        });

        expect(Response.json('string')).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify('string', null, 2),
            },
          ],
        });

        expect(Response.json(true)).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(true, null, 2),
            },
          ],
        });
      });

      it('should handle empty objects and arrays', () => {
        expect(Response.json({})).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify({}, null, 2),
            },
          ],
        });

        expect(Response.json([])).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify([], null, 2),
            },
          ],
        });
      });
    });
  });

  describe('ToolWrapper class', () => {
    describe('trace', () => {
      it('should wrap a tool handler and return result', async () => {
        const handler = ToolWrapper.trace('test-tool', async ({ value }: { value: number }) => {
          return Response.json({ result: value * 2 });
        });

        const result = await handler({ value: 21 });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
      });

      it('should handle async operations', async () => {
        const handler = ToolWrapper.trace('async-tool', async ({ delay }: { delay: number }) => {
          await new Promise(resolve => setTimeout(resolve, delay));
          return Response.text('completed');
        });

        const result = await handler({ delay: 10 });

        expect(result).toBeDefined();
        expect(result.content[0].text).toBe('completed');
      });

      it('should propagate errors from handler', async () => {
        const handler = ToolWrapper.trace('error-tool', async () => {
          throw new Error('Test error');
        });

        await expect(handler({})).rejects.toThrow('Test error');
      });

      it('should work with Response.json', async () => {
        const handler = ToolWrapper.trace('json-tool', async ({ data }) => {
          return Response.json(data);
        });

        const testData = { key: 'value', number: 42 };
        const result = await handler({ data: testData });

        expect(result.content[0].text).toContain('key');
        expect(result.content[0].text).toContain('value');
      });

      it('should work with Response.text', async () => {
        const handler = ToolWrapper.trace('text-tool', async ({ message }: { message: string }) => {
          return Response.text(message);
        });

        const result = await handler({ message: 'Hello, World!' });

        expect(result.content[0].text).toBe('Hello, World!');
      });
    });

    describe('traceWithMetrics', () => {
      it('should wrap handler and extract metrics', async () => {
        const handler = ToolWrapper.traceWithMetrics(
          'metrics-tool',
          async ({ count }: { count: number }) => {
            const items = Array(count).fill('item');
            return Response.json(items);
          },
          (result: any, params: { count: number }) => ({
            'item.count': params.count,
            'result.type': 'array',
          })
        );

        const result = await handler({ count: 5 });

        expect(result).toBeDefined();
      });

      it('should work without metrics extractor', async () => {
        const handler = ToolWrapper.traceWithMetrics('simple-tool', async ({ value }) => {
          return Response.text(String(value));
        });

        const result = await handler({ value: 42 });

        expect(result).toBeDefined();
        expect(result.content[0].text).toBe('42');
      });

      it('should handle errors in handler', async () => {
        const handler = ToolWrapper.traceWithMetrics(
          'error-metrics-tool',
          async () => {
            throw new Error('Handler error');
          },
          () => ({
            metric: 'value',
          })
        );

        await expect(handler({})).rejects.toThrow('Handler error');
      });
    });
  });

  describe('forwardUpstream401', () => {
    function makeResponseError(status: number, body: string, headers?: Record<string, string>) {
      const h = new Headers(headers);
      const response = new globalThis.Response(body, { status, headers: h });
      return new ResponseError(response);
    }

    it('should forward 401 when requestContext store has res', async () => {
      const endFn = jest.fn();
      const statusFn = jest.fn().mockReturnThis();
      const setHeaderFn = jest.fn();
      const fakeRes = {
        headersSent: false,
        status: statusFn,
        setHeader: setHeaderFn,
        end: endFn,
      } as any;

      const err = makeResponseError(401, '{"error":"unauthorized"}', {
        'www-authenticate': 'Bearer realm="api"',
        'content-type': 'application/json',
      });

      const result = await requestContext.run({ res: fakeRes }, () =>
        forwardUpstream401<{ content: any[]; isError: boolean }>(err)
      );

      expect(result).toEqual({ content: [], isError: true });
      expect(statusFn).toHaveBeenCalledWith(401);
      expect(setHeaderFn).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer realm="api"');
      expect(setHeaderFn).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(endFn).toHaveBeenCalledWith('{"error":"unauthorized"}');
    });

    it('should return null when no requestContext store (stdio mode)', async () => {
      const err = makeResponseError(401, 'unauthorized');
      const result = await forwardUpstream401(err);
      expect(result).toBeNull();
    });

    it('should return null for non-401 ResponseError', async () => {
      const err = makeResponseError(403, 'forbidden');
      const result = await forwardUpstream401(err);
      expect(result).toBeNull();
    });

    it('should return null for non-ResponseError', async () => {
      const err = new Error('something else');
      const result = await forwardUpstream401(err);
      expect(result).toBeNull();
    });

    it('should return null when headers already sent', async () => {
      const fakeRes = { headersSent: true, status: jest.fn(), end: jest.fn() } as any;
      const err = makeResponseError(401, 'unauthorized');

      const result = await requestContext.run({ res: fakeRes }, () => forwardUpstream401(err));

      expect(result).toBeNull();
      expect(fakeRes.status).not.toHaveBeenCalled();
    });
  });
});
