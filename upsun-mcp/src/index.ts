import dotenv from 'dotenv';

import { GatewayServer, LocalServer } from './core/gateway.js';
import { UpsunMcpServer } from './mcpUpsun.js';

dotenv.config();

const typeInstance = process.env.TYPE_ENV || 'remote';

if (typeInstance === 'local') {
  // STDIO
  const local = new LocalServer(UpsunMcpServer);
  local.listen();
} else {
  // SSE & Streamable
  const PORT = Number(String(process.env.PORT)) || 3000;
  const srv = new GatewayServer(UpsunMcpServer);
  srv.listen(PORT);
}
