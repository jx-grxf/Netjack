import cors from 'cors';
import express from 'express';
import http from 'http';
import os from 'os';
import { Server } from 'socket.io';
import { LobbyService } from './lobby/lobbyService';
import { LobbyStore } from './lobby/lobbyStore';
import { registerSocketHandlers } from './sockets/handlers';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_URLS = parseAllowedOrigins(process.env.CLIENT_URLS ?? process.env.CLIENT_URL ?? 'http://localhost:5173');
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? 2);
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_ENABLED = process.env.ADMIN_ENABLED === 'true';

function parseAllowedOrigins(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    // Non-browser clients (curl/health checks) may omit Origin.
    return true;
  }
  return CLIENT_URLS.includes(origin);
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const lobbyStore = new LobbyStore();
const lobbyService = new LobbyService(lobbyStore, { maxPlayers: MAX_PLAYERS });

const runtime = registerSocketHandlers(io, lobbyService);

function parseBasicAuthHeader(authHeader: string | undefined): { username: string; password: string } | null {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }
  const encoded = authHeader.slice(6).trim();
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;
    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return { username, password };
  } catch {
    return null;
  }
}

app.get('/admin/stats', (req, res) => {
  if (!ADMIN_ENABLED) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  if (!ADMIN_USER || !ADMIN_PASS) {
    res.status(500).json({ message: 'Admin auth is not configured' });
    return;
  }

  const auth = parseBasicAuthHeader(req.headers.authorization);
  if (!auth || auth.username !== ADMIN_USER || auth.password !== ADMIN_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="LAN Blackjack Admin"');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  res.json(runtime.getAdminStatsSnapshot());
});

function getLanAddress(): string | null {
  const interfaces = os.networkInterfaces();

  for (const infos of Object.values(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }

  return null;
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const lanAddress = getLanAddress();
  // eslint-disable-next-line no-console
  console.log(`Open on this device: http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Open on LAN: http://${lanAddress ?? '<your-local-ip>'}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Allowed client origins: ${CLIENT_URLS.join(', ')}`);
  // eslint-disable-next-line no-console
  console.log(`Admin route enabled: ${ADMIN_ENABLED ? 'yes' : 'no'}`);
});
