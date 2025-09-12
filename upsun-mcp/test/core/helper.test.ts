import { describe, expect, it } from '@jest/globals';
import { Schema, Assert, Response } from '../../src/core/helper.js';
import { z } from 'zod';

describe('Helper Module', () => {
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

    describe('organizationId', () => {
      it('should return a string schema with 27 character length requirement', () => {
        const schema = Schema.organizationId();
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.parse('123456789012345678901234567')).toBe('123456789012345678901234567');
      });

      it('should reject organization IDs not exactly 27 characters', () => {
        const schema = Schema.organizationId();
        expect(() => schema.parse('12345678901234567890123456')).toThrow(
          'Organization ID must be 27 characters long'
        );
        expect(() => schema.parse('1234567890123456789012345678')).toThrow(
          'Organization ID must be 27 characters long'
        );
        expect(() => schema.parse('')).toThrow('Organization ID must be 27 characters long');
      });
    });

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
});
