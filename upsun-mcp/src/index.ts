import dotenv from 'dotenv'; 

import { GatewayServer, LocalServer } from "./core/gateway.js";
import { UpsunMcpServer } from './mcpUpsun.js';

dotenv.config();

// STDIO
// const srvLocal = new LocalServer(UpsunMcpServer);
// srv.listen()

// SSE & Streamable
const PORT = Number(String(process.env.PORT)) || 3001;
const srv = new GatewayServer(UpsunMcpServer);
srv.listen(PORT);

