# Upsun MCP Server

A Model Context Protocol (MCP) server that provides comprehensive integration with the [Upsun](https://upsun.com/) cloud platform. This server exposes Upsun's APIs as MCP tools, enabling AI assistants like Claude to manage cloud infrastructure, deployments, and applications.

## 🚀 Hosted MCP Server Available

**The Upsun MCP server is hosted and ready to use at: https://mcp.upsun.com/mcp**

You don't need to install or run anything locally unless you're developing or customizing the server. Simply configure your MCP client to connect to the hosted service.

## ⚠️ Beta Release Notice

**This is a beta release** that defaults to **read-only operations** for safety. Write operations (creating, modifying, deleting resources) are disabled by default and can be enabled by configuring the matching header.

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

By default, this beta release only allows read operations. To enable write operations (create, update, delete), you need to add an extra header include write permissions when setting up your MCP client.

**⚠️ Warning**: Write operations are permanent and can delete resources. Use with caution in production environments.

```
"enable-write": "true"
```

## Using the Hosted MCP Server

### MCP Client Configuration

Add the Upsun MCP server to your MCP client configuration using the direct HTTP transport:

```json
{
  "servers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

## Installation instructions

Set up the Upsun MCP Server in under a minute:

1. Get your API token from the [Upsun Console](https://console.upsun.com/). Navigate to your account settings and generate a new API token with appropriate permissions for your projects.
2. Configure your MCP client to connect to https://mcp.upsun.com/mcp
3. Start managing infrastructure through natural language

The Upsun MCP server works with all major AI development environments. Choose your preferred client below:

&nbsp;
<details>
<summary><b>Install in Cursor</b></summary>

Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`

Pasting the following configuration into your Cursor `~/.cursor/mcp.json` file is the recommended approach. You may also install in a specific project by creating `.cursor/mcp.json` in your project folder. See [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) for more info.

#### Cursor Remote Server Connection

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Run this command. See [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp) for more info.

#### Claude Code Remote Server Connection

```sh
claude mcp add --transport http upsun https://mcp.upsun.com/mcp --header "upsun-api-token: YOUR_API_TOKEN" --header "enable-write: false"
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Add this to your Windsurf MCP config file. See [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) for more info.

#### Windsurf Remote Server Connection

```json
{
  "mcpServers": {
    "upsun": {
      "serverUrl": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in VS Code</b></summary>

Add this to your VS Code MCP config file. See [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more info.

#### VS Code Remote Server Connection

```json
"mcp": {
  "servers": {
    "upsun": {
      "type": "http",
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary>
<b>Install in Cline</b>
</summary>

You can easily configure the Upsun MCP server through Cline:

1. Open **Cline**.
2. Click the hamburger menu icon (☰) to enter the **MCP Servers** section.
3. Choose **Remote Servers** tab.
4. Click the **Edit Configuration** button.
5. Add upsun to `mcpServers`:

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "type": "streamableHttp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zed</b></summary>

Add this to your Zed `settings.json`. See [Zed Context Server docs](https://zed.dev/docs/assistant/context-servers) for more info.

```json
{
  "context_servers": {
    "Upsun": {
      "settings": {
        "url": "https://mcp.upsun.com/mcp",
        "headers": {
          "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
        }
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Augment Code</b></summary>

To configure the Upsun MCP server in Augment Code:

### **Manual Configuration**

1. Press Cmd/Ctrl Shift P or go to the hamburger menu in the Augment panel
2. Select Edit Settings
3. Under Advanced, click Edit in settings.json
4. Add the server configuration to the `mcpServers` array in the `augment.advanced` object

```json
"augment.advanced": {
  "mcpServers": [
    {
      "name": "upsun",
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  ]
}
```

Once the MCP server is added, restart your editor. If you receive any errors, check the syntax to make sure closing brackets or commas are not missing.

</details>

<details>
<summary><b>Install in Roo Code</b></summary>

Add this to your Roo Code MCP configuration file. See [Roo Code MCP docs](https://docs.roocode.com/features/mcp/using-mcp-in-roo) for more info.

#### Roo Code Remote Server Connection

```json
{
  "mcpServers": {
    "upsun": {
      "type": "streamable-http",
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Gemini CLI</b></summary>

See [Gemini CLI Configuration](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) for details.

1.  Open the Gemini CLI settings file. The location is `~/.gemini/settings.json` (where `~` is your home directory).
2.  Add the following to the `mcpServers` object in your `settings.json` file:

```json
{
  "mcpServers": {
    "upsun": {
      "httpUrl": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

If the `mcpServers` object does not exist, create it.

</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

#### Remote Server Connection

Open Claude Desktop and navigate to Settings > Connectors > Add Custom Connector. Enter the name as `Upsun` and the remote MCP server URL as `https://mcp.upsun.com/mcp`.

Add your API token in the headers configuration:

```json
{
  "upsun-api-token": "YOUR_API_TOKEN",
    "enable-write": "false"
}
```

</details>

<details>
<summary><b>Install in Opencode</b></summary>

Add this to your Opencode configuration file. See [Opencode MCP docs](https://opencode.ai/docs/mcp-servers) for more info.

#### Opencode Remote Server Connection

```json
"mcp": {
  "upsun": {
    "type": "remote",
    "url": "https://mcp.upsun.com/mcp",
    "headers": {
      "upsun-api-token": "YOUR_API_TOKEN",
    "enable-write": "false"
    },
    "enabled": true
  }
}
```

</details>

<details>
<summary><b>Install in JetBrains AI Assistant</b></summary>

See [JetBrains AI Assistant Documentation](https://www.jetbrains.com/help/ai-assistant/configure-an-mcp-server.html) for more details.

1. In JetBrains IDEs, go to `Settings` -> `Tools` -> `AI Assistant` -> `Model Context Protocol (MCP)`
2. Click `+ Add`.
3. Click on `Command` in the top-left corner of the dialog and select the As JSON option from the list
4. Add this configuration and click `OK`

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

5. Click `Apply` to save changes.
6. The same way upsun could be added for JetBrains Junie in `Settings` -> `Tools` -> `Junie` -> `MCP Settings`

</details>

<details>

<summary><b>Install in Kiro</b></summary>

See [Kiro Model Context Protocol Documentation](https://kiro.dev/docs/mcp/configuration/) for details.

1. Navigate `Kiro` > `MCP Servers`
2. Add a new MCP server by clicking the `+ Add` button.
3. Paste the configuration given below:

```json
{
  "mcpServers": {
    "Upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

4. Click `Save` to apply the changes.

</details>

<details>
<summary><b>Install in Trae</b></summary>

Use the Add manually feature and fill in the JSON configuration information for that MCP server.
For more details, visit the [Trae documentation](https://docs.trae.ai/ide/model-context-protocol?_lang=en).

#### Trae Remote Server Connection

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Amazon Q Developer CLI</b></summary>

Add this to your Amazon Q Developer CLI configuration file. See [Amazon Q Developer CLI docs](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-configuration.html) for more details.

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Warp</b></summary>

See [Warp Model Context Protocol Documentation](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server) for details.

1. Navigate `Settings` > `AI` > `Manage MCP servers`.
2. Add a new MCP server by clicking the `+ Add` button.
3. Paste the configuration given below:

```json
{
  "Upsun": {
    "url": "https://mcp.upsun.com/mcp",
    "headers": {
      "upsun-api-token": "YOUR_API_TOKEN",
    "enable-write": "false"
    },
    "start_on_launch": true
  }
}
```

4. Click `Save` to apply the changes.

</details>

<details>

<summary><b>Install in Copilot Coding Agent</b></summary>

## Using Upsun MCP with Copilot Coding Agent

Add the following configuration to the `mcp` section of your Copilot Coding Agent configuration file Repository->Settings->Copilot->Coding agent->MCP configuration:

```json
{
  "mcpServers": {
    "upsun": {
      "type": "http",
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

For more information, see the [official GitHub documentation](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).

</details>

<details>
<summary><b>Install in LM Studio</b></summary>

See [LM Studio MCP Support](https://lmstudio.ai/blog/lmstudio-v0.3.17) for more information.

#### Manual set-up:

1. Navigate to `Program` (right side) > `Install` > `Edit mcp.json`.
2. Paste the configuration given below:

```json
{
  "mcpServers": {
    "Upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

3. Click `Save` to apply the changes.
4. Toggle the MCP server on/off from the right hand side, under `Program`, or by clicking the plug icon at the bottom of the chat box.

</details>

<details>
<summary><b>Install in Visual Studio 2022</b></summary>

You can configure the Upsun MCP server in Visual Studio 2022 by following the [Visual Studio MCP Servers documentation](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).

Add this to your Visual Studio MCP config file (see the [Visual Studio docs](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022) for details):

```json
{
  "inputs": [],
  "servers": {
    "upsun": {
      "type": "http",
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

For more information and troubleshooting, refer to the [Visual Studio MCP Servers documentation](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).

</details>

<details>
<summary><b>Install in Crush</b></summary>

Add this to your Crush configuration file. See [Crush MCP docs](https://github.com/charmbracelet/crush#mcps) for more info.

#### Crush Remote Server Connection (HTTP)

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "upsun": {
      "type": "http",
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in BoltAI</b></summary>

Open the "Settings" page of the app, navigate to "Plugins," and configure the Upsun MCP server:

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

More information is available on [BoltAI's Documentation site](https://docs.boltai.com/docs/plugins/mcp-servers). For BoltAI on iOS, [see this guide](https://docs.boltai.com/docs/boltai-mobile/mcp-servers).

</details>

<details>
<summary><b>Install in Rovo Dev CLI</b></summary>

Edit your Rovo Dev CLI MCP config by running the command below -

```bash
acli rovodev mcp
```

Example config -

#### Remote Server Connection

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zencoder</b></summary>

To configure the Upsun MCP server in Zencoder, follow these steps:

1. Go to the Zencoder menu (...)
2. From the dropdown menu, select Agent tools
3. Click on the Add custom MCP
4. Add the name and server configuration from below, and make sure to hit the Install button

```json
{
  "url": "https://mcp.upsun.com/mcp",
  "headers": {
    "upsun-api-token": "YOUR_API_TOKEN",
    "enable-write": "false"
  }
}
```

Once the MCP server is added, you can easily continue using it.

</details>

<details>
<summary><b>Install in Qodo Gen</b></summary>

See [Qodo Gen docs](https://docs.qodo.ai/qodo-documentation/qodo-gen/qodo-gen-chat/agentic-mode/agentic-tools-mcps) for more details.

1. Open Qodo Gen chat panel in VSCode or IntelliJ.
2. Click Connect more tools.
3. Click + Add new MCP.
4. Add the following configuration:

#### Qodo Gen Remote Server Connection

```json
{
  "mcpServers": {
    "upsun": {
      "url": "https://mcp.upsun.com/mcp",
      "headers": {
        "upsun-api-token": "YOUR_API_TOKEN",
        "enable-write": "false"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Perplexity Desktop</b></summary>

See [Local and Remote MCPs for Perplexity](https://www.perplexity.ai/help-center/en/articles/11502712-local-and-remote-mcps-for-perplexity) for more information.

1. Navigate `Perplexity` > `Settings`
2. Select `Connectors`.
3. Click `Add Connector`.
4. Select `Advanced`.
5. Enter Server Name: `Upsun`
6. Paste the following JSON in the text area:

```json
{
  "url": "https://mcp.upsun.com/mcp",
  "headers": {
    "upsun-api-token": "YOUR_API_TOKEN",
    "enable-write": "false"
  }
}
```

7. Click `Save`.
</details>

## Local Development Setup

**Note**: This section is only needed if you want to develop, customize, or contribute to the MCP server. Most users should use the hosted version at https://mcp.upsun.com/mcp.

### Prerequisites for Development

- Node.js 18+ required
- TypeScript support

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd upsun-mcp-server/upsun-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Local Development Environment

Create a `.env` file in the `upsun-mcp` directory:

```env
# Required: Your Upsun API token
UPSUN_API_TOKEN=your-api-token-here

# Optional: Server configuration
PORT=3000
TYPE_ENV=remote

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
      "args": ["/path/to/upsun-mcp-server/upsun-mcp/build/index.js"],
      "env": {
        "UPSUN_API_TOKEN": "your-api-token-here",
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

## Troubleshooting

### Common Issues

1. **Authentication Failed**: Verify your API token is valid and has sufficient permissions
2. **Write Operations Disabled**: Check your `enable-write` header is set to `true`
3. **Connection Timeout**: Ensure network connectivity to Upsun APIs
4. **Resource Not Found**: Verify organization, project, and environment IDs

### Debugging the Hosted Service

For issues with the hosted MCP server:

1. **Check API token validity**: Verify your token is correctly set and hasn't expired
2. **Review MCP client logs**: Check your MCP client's logs for connection errors
3. **Test with minimal scope**: Start with read-only operations before enabling write permissions
4. **Check network connectivity**: Ensure you can reach https://mcp.upsun.com/mcp

For local development debugging:

```bash
LOG_LEVEL=DEBUG npm run dev
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

## Support

- **Hosted MCP Server**: https://mcp.upsun.com/mcp
- [Upsun Documentation](https://docs.upsun.com/)
- [API Token Setup Guide](https://docs.upsun.com/administration/cli/api-tokens.html#2-create-an-api-token)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

---

**⚠️ Beta Software Disclaimer**: This is beta software. Test thoroughly before using in production environments. Write operations can permanently modify or delete cloud resources.