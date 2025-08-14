import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- In-memory game state (resets on server restart) ----
const rooms = new Map(); // roomId -> { players: Map(socketId -> {name}), hostId, hands: Map(socketId -> cards[]) }

function makeRoomId() {
  // 6-char base62 id
  return crypto.randomBytes(4).toString('base64url').slice(0,6);
}

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push(`${r}${s}`);
  return deck;
}
function shuffle(array){
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

app.post('/api/create-room', (req, res) => {
  let roomId;
  do { roomId = makeRoomId(); } while (rooms.has(roomId));
  rooms.set(roomId, { players: new Map(), hostId: null, hands: new Map(), createdAt: Date.now() });
  res.json({ roomId, joinUrl: `${req.protocol}://${req.get('host')}/r/${roomId}` });
});

// Serve same app for /r/:roomId
app.get('/r/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, name }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error-message', 'Room not found. Create a new one.');
      return;
    }
    socket.join(roomId);
    room.players.set(socket.id, { name: name || 'Player' });
    if (!room.hostId) room.hostId = socket.id; // first joiner is host

    io.to(roomId).emit('room-state', {
      roomId,
      hostId: room.hostId,
      players: Array.from(room.players, ([id, obj]) => ({ id, name: obj.name }))
    });
  });

  socket.on('set-name', ({ roomId, name }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.name = name || 'Player';
    io.to(roomId).emit('room-state', {
      roomId,
      hostId: room.hostId,
      players: Array.from(room.players, ([id, obj]) => ({ id, name: obj.name }))
    });
  });

  socket.on('start-deal', ({ roomId, cardsPerPlayer = 6 }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) {
      socket.emit('error-message', 'Only the host can deal.');
      return;
    }
    const deck = shuffle(createDeck());
    const playerIds = Array.from(room.players.keys());
    const hands = new Map();
    for (const id of playerIds) hands.set(id, []);

    let index = 0;
    const totalToDeal = cardsPerPlayer * playerIds.length;
    for (let i = 0; i < totalToDeal; i++) {
      const card = deck.pop();
      const pid = playerIds[index % playerIds.length];
      hands.get(pid).push(card);
      index++;
    }
    room.hands = hands;

    // Send private hands
    for (const [pid, hand] of hands.entries()) {
      io.to(pid).emit('your-hand', hand);
    }
    // Public summary
    io.to(roomId).emit('round-started', {
      cardsPerPlayer,
      players: playerIds.map(pid => ({ id: pid, name: room.players.get(pid)?.name || 'Player', count: hands.get(pid).length }))
    });
  });

  socket.on('reveal-my-hand', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const hand = room.hands.get(socket.id) || [];
    io.to(roomId).emit('hand-revealed', {
      playerId: socket.id,
      name: room.players.get(socket.id)?.name || 'Player',
      hand
    });
  });

  socket.on('make-host', ({ roomId, playerId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) {
      socket.emit('error-message', 'Only host can transfer host.');
      return;
    }
    if (room.players.has(playerId)) {
      room.hostId = playerId;
      io.to(roomId).emit('room-state', {
        roomId,
        hostId: room.hostId,
        players: Array.from(room.players, ([id, obj]) => ({ id, name: obj.name }))
      });
    }
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.players.delete(socket.id);
        room.hands.delete(socket.id);
        if (room.hostId === socket.id) {
          // pick another host if any
          const next = room.players.keys().next();
          room.hostId = next.done ? null : next.value;
        }
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('room-state', {
            roomId,
            hostId: room.hostId,
            players: Array.from(room.players, ([id, obj]) => ({ id, name: obj.name }))
          });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mior Liar Bar server running on http://localhost:${PORT}`);
});