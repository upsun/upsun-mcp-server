import dotenv from 'dotenv'; 

import { GatewayServer } from "./core/gateway.js";
import { UpsunMcpServer } from './mcpUpsun.js';

dotenv.config();

const PORT = Number(String(process.env.PORT)) || 8888;
const srv = new GatewayServer(UpsunMcpServer);
srv.listen(PORT);

