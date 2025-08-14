# 🃏 Mior Liar Bar — Multiplayer Card Dealing

A super simple browser game for you and friends: create a room, share the link, everyone joins, the host deals **6 cards** to each player privately. Built with **Node.js + Express + Socket.IO**.

## Features
- Create room → get a shareable URL like `/r/ABC123`
- Join room from phone/desktop
- First player becomes host (can transfer host in code if needed)
- Host clicks **Deal** (default 6) → each player gets a private hand
- Optional: players can **Reveal my hand** to show it to the room (fun for testing)
- No database — in-memory state (best for casual games; restarts clear rooms)

## One‑click Run (Local)

```bash
# 1) Unzip, then inside the folder:
npm install

# 2) Start
npm start

# 3) Open
# http://localhost:3000
# Tap "Create Room", then share the shown URL to friends on the same network / internet (if port is open).
```

## Deploy (Free/Easy)

**Railway** or **Render** works great for WebSockets.

- Create a new Node app with this repo.
- Set **Start Command** to `node server.js`.
- After deploy, you’ll get a public base URL like `https://your-app.onrender.com/`.
- Players: open that URL, tap **Create Room**, share the `/r/ROOMID` link.

> **Note:** Vercel now supports WebSockets but setup is trickier with custom servers. If you know Vercel well, you can still deploy by turning this into a serverless build. Otherwise stick to Railway/Render/Heroku.

## How it works

- `POST /api/create-room` → returns `{ roomId, joinUrl }`
- `GET /r/:roomId` → serves the same client, which auto-joins the room
- **Socket events**
  - `join-room { roomId, name }`
  - `set-name { roomId, name }`
  - `start-deal { roomId, cardsPerPlayer }` (host only)
  - `your-hand [cards]` (private)
  - `round-started { players: [{id,name,count}], cardsPerPlayer }` (public)
  - `reveal-my-hand`
  - `hand-revealed { playerId, name, hand }`
- State kept in memory: `rooms` map with players, host, hands

## Customize
- Change deck/rules in `server.js` → `createDeck()` or `cardsPerPlayer`.
- Add chat, turn timer, or voting easily with more socket events.