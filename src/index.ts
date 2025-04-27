import dotenv from 'dotenv'; 

import { GatewayServer } from "./core/gateway.js";
import { UpsunMcpServer } from './mcpUpsun.js';

dotenv.config();

const srv = new GatewayServer(UpsunMcpServer);
srv.listen();

