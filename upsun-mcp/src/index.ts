import dotenv from 'dotenv'; 

import { GatewayServer, LocalServer } from "./core/gateway.js";
import { UpsunMcpServer } from './mcpUpsun.js';

dotenv.config();

//TODO: Use argument for select start mode
if (false) {
  // STDIO
  const local = new LocalServer(UpsunMcpServer);
  local.listen()
} else {
  // SSE & Streamable
  const PORT = Number(String(process.env.PORT)) || 3000;
  const srv = new GatewayServer(UpsunMcpServer);
  srv.listen(PORT);
}
