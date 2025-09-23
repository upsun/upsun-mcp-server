# Upsun MCP Server - Development Guide

This document provides technical information for **local development** and maintenance of the Upsun MCP Server.

**Note**: The Upsun MCP server is hosted and available at https://mcp.upsun.com/mcp. This guide is for developers who want to contribute to, customize, or run the server locally for development purposes.

## Hosted vs. Local Development

### Using the Hosted Service (Recommended for Users)
- **URL**: https://mcp.upsun.com/mcp
- **Purpose**: Production-ready MCP server for end users
- **Setup**: Configure your MCP client to connect to the hosted service
- **Maintenance**: Managed by the Upsun team

### Local Development (For Contributors)
- **Purpose**: Development, testing, and contribution to the codebase
- **Setup**: Clone repository, install dependencies, run locally
- **Use cases**: Adding features, fixing bugs, customizing behavior

## Quick Reference

### Essential Development Commands

```bash
# Development workflow
npm run build          # Compile TypeScript
npm run watch          # Watch mode for development
npm run test           # Run test suite
npm run test:watch     # Run tests in watch mode
npm run lint           # Check code quality
npm run prettier       # Format code
```

### Key Environment Variables

```bash
# Required
UPSUN_API_KEY=your-api-token

# Write Operations (Beta Safety)
enable-write=true  # Enable write ops via header

# Server Configuration
TYPE_ENV=local         # stdio mode
TYPE_ENV=remote        # HTTP/SSE mode (default)
PORT=3000             # Server port (remote mode)

# Debugging
LOG_LEVEL=DEBUG       # DEBUG, INFO, WARN, ERROR, NONE
NODE_ENV=development  # development, production, test
```

## Write Operations Control

**Critical**: This beta release defaults to read-only mode. Write operations are controlled by the `enable-write` header:

- **Default**: Read-only operations only
- **Write enabled**: Set `enable-write: true` header in MCP client configuration

Example header configuration:
```json
{
  "headers": {
    "upsun-api-token": "your-api-token",
    "enable-write": "true"
  }
}
```

## Project Structure

```
upsun-mcp/
├── src/
│   ├── core/           # Core MCP and infrastructure
│   │   ├── adapter.ts  # MCP adapter interface
│   │   ├── gateway.ts  # HTTP/SSE server
│   │   ├── authentication.ts # Bearer token & authentication handling
│   │   ├── logger.ts   # Structured logging
│   │   └── helper.ts   # Common utilities
│   ├── command/        # MCP tool implementations
│   │   ├── index.ts    # Command exports
│   │   ├── project.ts  # Project management
│   │   ├── environment.ts # Environment operations
│   │   ├── organization.ts # Organization tools
│   │   ├── activity.ts # Activity monitoring
│   │   ├── ssh.ts      # SSH key management
│   │   ├── domain.ts   # Domain configuration
│   │   ├── route.ts    # Route management
│   │   ├── certificate.ts # SSL certificates
│   │   └── backup.ts   # Backup operations
│   ├── task/           # MCP prompt implementations
│   │   ├── index.ts    # Task exports
│   │   └── config.ts   # Config generation prompts
│   ├── index.ts        # Main entry point
│   └── mcpUpsun.ts     # Primary MCP server class
├── test/               # Test suites (mirrors src/)
├── build/              # Compiled JavaScript output
├── package.json        # Dependencies & scripts
├── tsconfig.json       # TypeScript configuration
├── jest.config.ts      # Test configuration
└── .env               # Local environment variables
```

## Architecture Overview

### Core Classes

- **`UpsunMcpServer`**: Main MCP server implementation
- **`McpAdapter`**: Interface defining MCP server contract
- **`GatewayServer`**: HTTP/SSE transport with authentication handling
- **`LocalServer`**: stdio transport for development

### Transport Modes

1. **Local (stdio)**: Direct communication via stdin/stdout
   ```bash
   TYPE_ENV=local npm run run
   ```

2. **Remote (HTTP/SSE)**: Web server with HTTP authentication support
   ```bash
   TYPE_ENV=remote PORT=3000 npm run run
   ```

### Authentication Flow

1. **API Key**: Direct authentication via `upsun-api-token` header
2. **Bearer Token**: Alternative authentication via `Authorization: Bearer` header
3. **Write Control**: Write operations controlled via `enable-write` header

## Development Workflow

### 1. Setup

```bash
cd upsun-mcp
npm install
cp .env.example .env  # Configure your API token
```

### 2. Development Mode

```bash
# Terminal 1: Watch compilation
npm run watch

# Terminal 2: Run server in stdio mode
TYPE_ENV=local npm run run

# Terminal 3: Run tests in watch mode
npm run test:watch
```

### 3. Testing

```bash
# Full test suite
npm test

# With coverage
npm run test:coverage

# Coverage verification
npm run coverage:check
```

### 4. Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run prettier
npm run prettier:check
```

## Adding New Commands

### 1. Create Command Module

Create `src/command/newfeature.ts`:

```typescript
import { McpAdapter } from '../core/adapter.js';
import { Response, Schema } from '../core/helper.js';
import { createLogger } from '../core/logger.js';
import { z } from 'zod';

const log = createLogger('MCP:Tool:newfeature-commands');

export function registerNewFeature(adapter: McpAdapter): void {
  log.info('Register NewFeature Handlers');

  adapter.server.tool(
    'action-newfeature',
    'Description of the action',
    {
      param1: z.string(),
      param2: Schema.projectId().optional(),
    },
    async ({ param1, param2 }) => {
      log.debug(`Action: ${param1}`);
      const result = await adapter.client.newfeature.action(param1, param2);
      return Response.json(result);
    }
  );
}
```

### 2. Export from Index

Add to `src/command/index.ts`:

```typescript
export * from './newfeature.js';
```

### 3. Register in Main Server

Add to `src/mcpUpsun.ts` constructor:

```typescript
import { registerNewFeature } from './command/index.js';

constructor() {
  // ... existing registrations
  registerNewFeature(this);
}
```

### 4. Add Tests

Create `test/command/newfeature.test.ts`:

```typescript
import { registerNewFeature } from '../../src/command/newfeature.js';
// ... test implementation
```

## Testing Strategy

### Unit Tests
- Each command module has corresponding tests
- Mock Upsun SDK client responses
- Test parameter validation and error handling

### Integration Tests
- Test full MCP server initialization
- Test transport layer functionality
- Test authentication flows

### Coverage Requirements
- Minimum 80% line coverage
- All command modules must be tested
- Critical paths require 100% coverage

## Debugging

### Logging Levels

```bash
LOG_LEVEL=DEBUG    # Verbose debugging information
LOG_LEVEL=INFO     # General operational info (default)
LOG_LEVEL=WARN     # Warning conditions
LOG_LEVEL=ERROR    # Error conditions only
LOG_LEVEL=NONE     # No logging
```

### Common Debug Scenarios

1. **Authentication Issues**:
   ```bash
   LOG_LEVEL=DEBUG npm run run
   # Check token extraction and validation logs
   ```

2. **Transport Problems**:
   ```bash
   # Test stdio mode
   TYPE_ENV=local LOG_LEVEL=DEBUG npm run run

   # Test HTTP mode
   TYPE_ENV=remote LOG_LEVEL=DEBUG npm run run
   ```

3. **SDK Integration**:
   ```bash
   # Enable SDK debug logging in test environment
   ```

## Security Considerations

### API Token Handling
- Never log full API tokens (automatically masked)
- Store tokens in environment variables, never in code
- Use separate tokens for development/production

### Header-based Security
- Validate all authentication tokens
- Implement proper header validation
- Control write operations via explicit headers

### Write Operations
- Default to read-only in beta
- Require explicit `enable-write: true` header for writes
- Log all write operations for audit trail

## Local Build Process

### Development Build

```bash
npm run clean      # Remove old build artifacts
npm run build      # Compile TypeScript to JavaScript
```

### Build Output
- Compiled to `build/` directory
- Main entry: `build/index.js` (executable)
- Source maps included for debugging

### Running Your Local Build

For development and testing purposes:

```bash
# Local development mode (stdio)
TYPE_ENV=local npm run run

# Local server mode (HTTP/SSE)
TYPE_ENV=remote PORT=3000 npm run run
```

**Note**: For production usage, users should connect to the hosted service at https://mcp.upsun.com/mcp rather than running their own instance.

## Troubleshooting

### Common Development Issues

1. **"Cannot find module" errors**: Run `npm run build`
2. **Test failures**: Check mock configurations in test files
3. **TypeScript errors**: Verify SDK version compatibility
4. **Authentication failures**: Check API token validity

### Performance Considerations

- Use connection pooling for high-throughput scenarios
- Implement request caching for repeated operations
- Monitor memory usage with long-running processes

### Dependencies

Key dependencies and their purposes:
- `@modelcontextprotocol/sdk`: Core MCP functionality
- `upsun-sdk-node`: Upsun API client
- `express`: HTTP server for remote mode
- `pino`: High-performance logging
- `zod`: Runtime type validation
- `dotenv`: Environment variable loading

## Contributing Guidelines

1. **Branch naming**: `feature/description` or `fix/description`
2. **Commit messages**: Use conventional commits format
3. **Code style**: Follow existing TypeScript/ESLint configuration
4. **Testing**: All new features require tests
5. **Documentation**: Update README.md and CLAUDE.md as needed

### Pull Request Checklist

- [ ] Code builds without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run prettier`)
- [ ] Coverage requirements met (`npm run coverage:check`)
- [ ] Documentation updated if needed

---

## Important Notes

- **For End Users**: Use the hosted MCP server at https://mcp.upsun.com/mcp
- **For Developers**: This guide covers local development and contribution workflows
- **Beta Software**: Always test thoroughly in development environments

**Remember**: The hosted service is maintained and optimized by the Upsun team. Local development is intended for contributors and customization needs only.