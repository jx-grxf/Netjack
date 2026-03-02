<div align="center">

# 🃏 Netjack

**Real-time multiplayer Blackjack for local networks**

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

Netjack is a real-time multiplayer Blackjack game for local networks, built with a TypeScript monorepo (`client` + `server`) and Socket.IO.

---

## ✨ Highlights

| | Feature |
|---|---|
| 🏠 | Host-and-join lobby flow with 6-character lobby codes |
| 🛡️ | Server-authoritative Blackjack rules and turn validation |
| ✂️ | Split and double-down support |
| 📊 | Round stats and event log |
| 💬 | Realtime lobby chat |
| 🔒 | Optional admin stats endpoint (disabled by default) |

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 5, TypeScript, Tailwind CSS |
| **Backend** | Node.js 20, Express 4, Socket.IO 4, TypeScript, Vitest |
| **Monorepo** | npm workspaces |

---

## 📋 Requirements

- **Node.js** `20.x` — see [.nvmrc](.nvmrc)
- **npm** `9+`

---

## 🚀 Quick Start

```bash
npm ci        # install all workspace dependencies
npm run dev   # start client + server in watch mode
```

| Service | URL |
|---|---|
| Client | http://localhost:5173 |
| Server | http://localhost:3001 |

---

## ⚙️ Configuration

Safe environment templates are included in the repo:

| Template | Purpose |
|---|---|
| [.env.server.example](.env.server.example) | Server environment variables |
| [.env.client.example](.env.client.example) | Client environment variables |

**Recommended setup:**

1. Copy server template values into your shell env or a local server env file.
2. Copy client template values into `client/.env.local`.
3. Keep secrets out of git.

### 🔐 Security Defaults

> - Admin endpoint (`/admin/stats`) is **off** unless `ADMIN_ENABLED=true`.
> - No default admin credentials are baked into server runtime.
> - CORS is restricted to the `CLIENT_URLS` allowlist (comma-separated origins).

---

## 📜 Scripts

Run from the repository root:

| Command | Description |
|---|---|
| `npm run dev` | Start client + server in watch mode |
| `npm run check` | Workspace type checks |
| `npm run test` | Run all workspace tests |
| `npm run build` | Production builds for all packages |
| `npm run ci` | check + test + build |

**Workspace-specific:**

```bash
npm run dev -w server
npm run dev -w client
npm run test -w server
npm run check -w client
```

---

## 🌐 LAN Usage

1. Start the app with `npm run dev`.
2. Open the client on the host machine.
3. Other devices on the same network can connect at `http://<host-ip>:5173`.
4. Create or join a lobby using the 6-character code.

**Find your host IP:**

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I

# Windows (PowerShell)
ipconfig
```

---

## 📦 Production Notes

**Build all packages:**

```bash
npm run build
```

**Start backend from built output:**

```bash
npm run start -w server
```

Serve the `client/dist` output with your preferred static host.

---

## 🗂️ Project Structure

```text
Netjack/
├── client/               # React + Vite frontend
├── server/               # Node.js + Express + Socket.IO backend
├── .github/workflows/    # CI pipeline
└── README.md
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

---

## 📄 License

[MIT](LICENSE)
