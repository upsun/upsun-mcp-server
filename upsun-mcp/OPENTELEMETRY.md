# OpenTelemetry Configuration Guide

This document describes how to configure and use OpenTelemetry tracing in the Upsun MCP Server.

## Overview

The Upsun MCP Server integrates OpenTelemetry for distributed tracing, providing observability into request flows, performance metrics, and debugging capabilities.

## Key Features

- **Configurable Sampling**: Different sampling rates for development (100%) and production (10%)
- **Multiple Exporters**: Console output for development, OTLP for production
- **Automatic Instrumentation**: Express, HTTP, and custom spans
- **Environment-based Configuration**: Easy setup via environment variables

## Environment Variables

### Core Settings

| Variable             | Description                                  | Default            | Values                      |
| -------------------- | -------------------------------------------- | ------------------ | --------------------------- |
| `OTEL_ENABLED`       | Enable/disable OpenTelemetry tracing         | `true`             | `true`, `false`             |
| `OTEL_SAMPLING_RATE` | Percentage of traces to capture (0.0 to 1.0) | `1.0`              | `0.0` - `1.0`               |
| `OTEL_EXPORTER_TYPE` | Type of trace exporter to use                | `console`          | `console`, `otlp`, `none`   |
| `OTEL_SERVICE_NAME`  | Service name in traces                       | `upsun-mcp-server` | Any string                  |
| `NODE_ENV`           | Application environment                      | `development`      | `development`, `production` |

### OTLP Exporter Settings

| Variable                 | Description                 | Default                           | Required When             |
| ------------------------ | --------------------------- | --------------------------------- | ------------------------- |
| `OTEL_EXPORTER_ENDPOINT` | OTLP collector endpoint URL | `http://localhost:4318/v1/traces` | `OTEL_EXPORTER_TYPE=otlp` |

## Configuration Examples

### Development Environment

For local development with 100% trace sampling and console output:

```bash
# .env file
OTEL_ENABLED=true
OTEL_SAMPLING_RATE=1.0
OTEL_EXPORTER_TYPE=console
OTEL_SERVICE_NAME=upsun-mcp-server
NODE_ENV=development
```

### Production Environment

For production with 10% sampling and OTLP export:

```bash
# .env file
OTEL_ENABLED=true
OTEL_SAMPLING_RATE=0.1
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_ENDPOINT=https://your-otlp-collector.example.com/v1/traces
OTEL_SERVICE_NAME=upsun-mcp-server
NODE_ENV=production
```

### Disabled Tracing

To completely disable OpenTelemetry:

```bash
# .env file
OTEL_ENABLED=false
```

## Sampling Strategies

### Development (100% Sampling)

```bash
OTEL_SAMPLING_RATE=1.0
```

- Captures all traces
- Useful for debugging and development
- Higher resource usage

### Production (10% Sampling)

```bash
OTEL_SAMPLING_RATE=0.1
```

- Captures 10% of traces
- Reduces overhead
- Still provides good observability
- Recommended for production workloads

### Custom Sampling

You can set any value between 0.0 and 1.0:

```bash
OTEL_SAMPLING_RATE=0.25  # 25% of traces
OTEL_SAMPLING_RATE=0.5   # 50% of traces
```

## Exporter Types

### Console Exporter

Best for development and debugging:

```bash
OTEL_EXPORTER_TYPE=console
```

- Outputs traces to console
- Easy to read and debug
- No external dependencies

### OTLP Exporter

Best for production with observability platforms:

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_ENDPOINT=https://your-collector.example.com/v1/traces
```

- Sends traces to OTLP-compatible collectors
- Works with Jaeger, Grafana Tempo, Honeycomb, etc.
- Requires OTLP endpoint configuration

### None Exporter

Traces are collected but not exported:

```bash
OTEL_EXPORTER_TYPE=none
```

- Useful for testing without overhead
- Tracing code runs but doesn't send data

## Verification

To verify your OpenTelemetry configuration is working:

1. Set `OTEL_EXPORTER_TYPE=console` temporarily
2. Start the server
3. Check the startup logs for the configuration summary:

```
Configuration:
  OpenTelemetry:
    - Enabled: true
    - Sampling Rate: 100%
    - Exporter: console
    - Service Name: upsun-mcp-server
    - Environment: development
```

4. Make a request and observe trace output in the console

## Integration with Observability Platforms

### Jaeger

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_ENDPOINT=http://jaeger-collector:4318/v1/traces
```

### Grafana Tempo

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_ENDPOINT=http://tempo:4318/v1/traces
```

### Honeycomb

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_ENDPOINT=https://api.honeycomb.io/v1/traces
```

### AWS X-Ray

```bash
OTEL_EXPORTER_TYPE=otlp
OTEL_EXPORTER_ENDPOINT=http://xray-collector:4318/v1/traces
```

## Troubleshooting

### No traces appearing

1. Check `OTEL_ENABLED=true` is set
2. Verify sampling rate is not 0.0
3. Confirm exporter type is not `none`
4. Check exporter endpoint is reachable (for OTLP)

### Performance issues

1. Reduce sampling rate: `OTEL_SAMPLING_RATE=0.1`
2. Consider switching to `OTEL_EXPORTER_TYPE=none` temporarily
3. Verify OTLP endpoint is responsive

### Configuration not applying

1. Ensure `.env` file is in the correct location
2. Restart the server after changes
3. Check for typos in environment variable names
4. Verify no overriding environment variables in your shell

## Best Practices

1. **Development**: Use 100% sampling with console exporter
2. **Staging**: Use 50-100% sampling with OTLP exporter
3. **Production**: Use 5-10% sampling with OTLP exporter
4. **Resource Name**: Use descriptive service names per environment
5. **Monitoring**: Set up alerts on trace data in your observability platform

## Next Steps

After configuring OpenTelemetry, you can:

- View distributed traces across your infrastructure
- Set up alerts on latency or error rates
- Analyze performance bottlenecks
- Debug production issues with trace data
- Create dashboards for monitoring
