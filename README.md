# Upsun MCP Server

A Model Context Protocol (MCP) server that provides comprehensive integration with the [Upsun](https://upsun.com/) cloud platform. This server exposes Upsun's APIs as MCP tools, enabling AI assistants like Claude to manage cloud infrastructure, deployments, and applications.

## 🚀 Hosted MCP Server Available

**The Upsun MCP server is hosted and ready to use at: https://mcp.upsun.com**

You don't need to install or run anything locally unless you're developing or customizing the server. Simply configure your MCP client to connect to the hosted service.

## ⚠️ Beta Release Notice

**This is a beta release** that defaults to **read-only operations** for safety. Write operations (creating, modifying, deleting resources) are disabled by default and can be enabled by configuring the OAuth scope.

## Features

### 🔧 Project Management
- **create-project**: Create new Upsun projects within organizations
- **delete-project**: Permanently delete projects and all resources
- **info-project**: Get detailed project information and metadata
- **list-project**: List all projects in an organization

### 🌍 Environment Management
- **activate-environment**: Activate paused environments
- **delete-environment**: Permanently delete environments
- **info-environment**: Get environment details and status
- **list-environment**: List all environments in a project
- **merge-environment**: Merge environment changes to parent
- **pause-environment**: Pause active environments
- **redeploy-environment**: Trigger new deployments
- **resume-environment**: Resume paused environments
- **urls-environment**: Get all URLs for an environment

### 🏢 Organization Management
- **info-organization**: Get organization details
- **list-organization**: List all accessible organizations

### 📊 Activity & Monitoring
- **list-activity**: View deployment activities and logs
- **info-activity**: Get detailed activity information

### 🔐 Security & Access
- **create-ssh**: Create SSH keys
- **delete-ssh**: Remove SSH keys
- **list-ssh**: List all SSH keys

### 🌐 Networking & Domains
- **add-domain**: Add custom domains
- **delete-domain**: Remove domains
- **info-domain**: Get domain configuration details
- **list-domain**: List all domains
- **update-domain**: Modify domain settings

### 🛣️ Routing
- **info-route**: Get route configuration details
- **list-route**: List all routes for environments

### 🔒 SSL/TLS Certificates
- **add-certificate**: Add SSL certificates
- **delete-certificate**: Remove certificates
- **info-certificate**: Get certificate details
- **list-certificate**: List all certificates

### 💾 Backup Management
- **create-backup**: Create environment backups
- **list-backup**: List available backups
- **restore-backup**: Restore from backups

### 🔧 Configuration
- **generate-config**: Create Upsun project configuration templates

## Prerequisites

### Upsun API Token (Required)

You **must** have a valid Upsun API token to use this MCP server. Follow these steps:

1. Go to the [Upsun Console](https://console.upsun.com/)
2. Navigate to your account settings
3. Create an API token following the [official documentation](https://docs.upsun.com/administration/cli/api-tokens.html#2-create-an-api-token)
4. Copy the token for configuration

### Enabling Write Operations

By default, this beta release only allows read operations. To enable write operations (create, update, delete), you need to configure the OAuth scope to include write permissions when setting up your MCP client.

**⚠️ Warning**: Write operations are permanent and can delete resources. Use with caution in production environments.

## Using the Hosted MCP Server

### MCP Client Configuration

Add the Upsun MCP server to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "servers": {
    "upsun": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {
        "MCP_SERVER_URL": "https://mcp.upsun.com",
        "UPSUN_API_KEY": "your-api-token-here"
      }
    }
  }
}
```

Or using the direct HTTP transport:

```json
{
  "servers": {
    "upsun": {
      "url": "https://mcp.upsun.com",
      "headers": {
        "Authorization": "Bearer your-api-token-here"
      }
    }
  }
}
```

### OAuth Scope Configuration

To enable write operations, ensure your API token includes the necessary permissions or configure the OAuth scope:

- **Read-only (default)**: No additional configuration needed
- **Write operations enabled**: Set `OAUTH_SCOPE=offline_access read write` in your environment or MCP client configuration

## Local Development Setup

**Note**: This section is only needed if you want to develop, customize, or contribute to the MCP server. Most users should use the hosted version at https://mcp.upsun.com.

### Prerequisites for Development

- Node.js 18+ required
- TypeScript support

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd demo-mcp/upsun-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Local Development Environment

Create a `.env` file in the `upsun-mcp` directory:

```env
# Required: Your Upsun API token
UPSUN_API_KEY=your-api-token-here

# Optional: Server configuration
PORT=3000
TYPE_ENV=remote

# Optional: OAuth configuration for write operations
OAUTH_SCOPE=offline_access read write

# Optional: Logging
LOG_LEVEL=INFO
NODE_ENV=production
```

### Running Locally

#### Local Development (stdio)

```bash
# Set environment for local stdio mode
export TYPE_ENV=local

# Run the server
npm run build && npm run run
```

#### Remote Server (HTTP/SSE)

```bash
# Default remote mode
npm run build && npm run run

# Or specify port
PORT=4000 npm run build && npm run run
```

#### Local MCP Client Configuration

For local development, configure your MCP client to use the local server:

```json
{
  "servers": {
    "upsun-local": {
      "command": "node",
      "args": ["/path/to/demo-mcp/upsun-mcp/build/index.js"],
      "env": {
        "UPSUN_API_KEY": "your-api-token-here",
        "TYPE_ENV": "local"
      }
    }
  }
}
```

### Development Scripts

```bash
# Build the project
npm run build

# Run tests
npm test

# Watch mode for development
npm run watch

# Linting and formatting
npm run lint
npm run lint:fix
npm run prettier
npm run prettier:check

# Coverage reports
npm run test:coverage
npm run coverage:check
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# CI mode
npm run test:ci
```

### Debugging

The server includes comprehensive logging. Set the log level:

```env
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARN, ERROR, NONE
```

## Architecture

### Core Components

- **`McpAdapter`**: Main adapter interface for MCP integration
- **`UpsunMcpServer`**: Primary server implementation
- **`GatewayServer`**: HTTP/SSE transport handler
- **`LocalServer`**: stdio transport for development

### Command Modules

Each feature area is organized into command modules:
- `src/command/project.ts` - Project management
- `src/command/environment.ts` - Environment operations
- `src/command/organization.ts` - Organization management
- `src/command/activity.ts` - Activity monitoring
- `src/command/ssh.ts` - SSH key management
- `src/command/domain.ts` - Domain configuration
- `src/command/route.ts` - Route management
- `src/command/certificate.ts` - SSL certificate handling
- `src/command/backup.ts` - Backup operations

### Authentication

Supports multiple authentication methods:
- **Bearer Token**: Primary OAuth2-based authentication
- **API Key**: Legacy authentication (via `UPSUN_API_KEY`)

OAuth2 endpoints are automatically configured at:
- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`

## API Reference

### Tool Parameters

Most tools accept standard Upsun identifiers:
- `organization_id`: Organization UUID
- `project_id`: Project ID
- `environment_id`: Environment ID
- `activity_id`: Activity/deployment ID

### Response Format

All tools return JSON responses with consistent structure:

```json
{
  "success": true,
  "data": {
    // Resource data
  }
}
```

## Security Considerations

1. **API Token Security**: Never commit API tokens to version control
2. **Write Operations**: Be extremely careful with write operations in production
3. **Scope Limitations**: Use minimal OAuth scopes for your use case
4. **Network Security**: Use HTTPS in production deployments

## Troubleshooting

### Common Issues

1. **Authentication Failed**: Verify your API token is valid and has sufficient permissions
2. **Write Operations Disabled**: Check your `OAUTH_SCOPE` includes `write`
3. **Connection Timeout**: Ensure network connectivity to Upsun APIs
4. **Resource Not Found**: Verify organization, project, and environment IDs

### Debugging the Hosted Service

For issues with the hosted MCP server:

1. **Check API token validity**: Verify your token is correctly set and hasn't expired
2. **Review MCP client logs**: Check your MCP client's logs for connection errors
3. **Test with minimal scope**: Start with read-only operations before enabling write permissions
4. **Check network connectivity**: Ensure you can reach https://mcp.upsun.com

For local development debugging:

```bash
LOG_LEVEL=DEBUG npm run run
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and tests: `npm run lint && npm test`
5. Submit a pull request

### Code Style

- TypeScript with strict mode
- ESLint configuration provided
- Prettier for code formatting
- Comprehensive test coverage required

## License

[License information here]

## Support

- **Hosted MCP Server**: https://mcp.upsun.com
- [Upsun Documentation](https://docs.upsun.com/)
- [API Token Setup Guide](https://docs.upsun.com/administration/cli/api-tokens.html#2-create-an-api-token)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

---

**⚠️ Beta Software Disclaimer**: This is beta software. Test thoroughly before using in production environments. Write operations can permanently modify or delete cloud resources.