# Netjack

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

Netjack is a real-time multiplayer Blackjack game for local networks, built with a TypeScript monorepo (`client` + `server`) and Socket.IO.

## Highlights

- Host-and-join lobby flow with 6-character lobby codes
- Server-authoritative Blackjack rules and turn validation
- Split and double-down support
- Round stats and event log
- Realtime lobby chat
- Optional admin stats endpoint (disabled by default)

## Tech Stack

- `server/`: Node.js, Express, Socket.IO, TypeScript, Vitest
- `client/`: React, Vite, TypeScript, Tailwind CSS
- Root: npm workspaces for unified scripts

## Requirements

- Node.js `20.x` (see [.nvmrc](.nvmrc))
- npm `9+`

## Quick Start

```bash
npm ci
npm run dev
```

Default local URLs:
- Client: `http://localhost:5173`
- Server: `http://localhost:3001`

## Configuration

This repo includes safe templates:
- [.env.server.example](.env.server.example)
- [.env.client.example](.env.client.example)

Recommended setup:

1. Copy server template values into your shell env or local server env file.
2. Copy client template values into `client/.env.local`.
3. Keep secrets out of git.

### Important Security Defaults

- Admin endpoint (`/admin/stats`) is **off** unless `ADMIN_ENABLED=true`.
- No default admin credentials are baked into server runtime.
- CORS is restricted to `CLIENT_URLS` allowlist (comma-separated origins).

## Scripts

From repository root:

- `npm run dev`: run client + server in watch mode
- `npm run check`: workspace type checks (when available)
- `npm run test`: workspace tests
- `npm run build`: workspace production builds
- `npm run ci`: check + test + build

Workspace-specific examples:

```bash
npm run dev -w server
npm run dev -w client
npm run test -w server
npm run check -w client
```

## LAN Usage

1. Start with `npm run dev`.
2. Open the client on the host machine.
3. On other devices in the same network, open:
   - `http://<host-ip>:5173`
4. Create or join a lobby with the 6-character code.

Find host IP:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I

# Windows (PowerShell)
ipconfig
```

## Production Notes

- Build all packages:

```bash
npm run build
```

- Start backend from built output:

```bash
npm run start -w server
```

- Serve the `client/dist` output with your preferred static host.

## Project Structure

```text
Netjack/
├── client/
├── server/
├── .github/workflows/ci.yml
└── README.md
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
