const socket = io();

// Helpers
function qs(id){ return document.getElementById(id); }
function setHidden(el, hidden){ el.classList.toggle('hidden', hidden); }

function getRoomIdFromUrl() {
  const m = window.location.pathname.match(/\/r\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  const p = new URLSearchParams(window.location.search);
  return p.get('room') || '';
}

let ROOM_ID = getRoomIdFromUrl();
let IS_JOINED = false;

// UI elements
const createBtn = qs('createRoomBtn');
const joinBtn = qs('joinRoomBtn');
const roomInput = qs('roomInput');
const shareUrl = qs('shareUrl');
const lobby = qs('lobby');
const handArea = qs('handArea');
const handDiv = qs('hand');
const dealBtn = qs('dealBtn');
const cpp = qs('cpp');
const playersDiv = qs('players');
const hostLabel = qs('hostLabel');
const roomIdLabel = qs('roomIdLabel');
const nameInput = qs('nameInput');
const saveNameBtn = qs('saveNameBtn');
const roundInfo = qs('roundInfo');
const roundSummary = qs('roundSummary');
const reveals = qs('reveals');
const revealBtn = qs('revealBtn');

function updateShareUrl() {
  if (!ROOM_ID) { shareUrl.textContent = ''; return; }
  const url = `${location.origin}/r/${ROOM_ID}`;
  shareUrl.textContent = url;
  // Also set address bar
  window.history.replaceState({}, '', `/r/${ROOM_ID}`);
}

async function createRoom() {
  const res = await fetch('/api/create-room', { method: 'POST' });
  const data = await res.json();
  ROOM_ID = data.roomId;
  updateShareUrl();
  joinRoom(); // auto-join after create
}
function joinRoom() {
  if (!ROOM_ID) ROOM_ID = roomInput.value.trim();
  if (!ROOM_ID) return alert('Enter a Room ID or create one.');
  socket.emit('join-room', { roomId: ROOM_ID, name: localStorage.getItem('mlb_name') || '' });
  setHidden(qs('createJoin'), true);
  setHidden(lobby, false);
  updateShareUrl();
  roomIdLabel.textContent = ROOM_ID;
  IS_JOINED = true;
}
function setName() {
  const name = nameInput.value.trim() || 'Player';
  localStorage.setItem('mlb_name', name);
  socket.emit('set-name', { roomId: ROOM_ID, name });
}

function renderPlayers(state) {
  playersDiv.innerHTML = '';
  state.players.forEach(p => {
    const span = document.createElement('span');
    span.className = 'badge' + (p.id === state.hostId ? ' host' : '');
    span.textContent = (p.id === socket.id ? 'You: ' : '') + p.name;
    playersDiv.appendChild(span);
    if (p.id === state.hostId) hostLabel.textContent = p.name;
  });
  dealBtn.disabled = (socket.id !== state.hostId);
}

function renderHand(cards) {
  handDiv.innerHTML = '';
  cards.forEach(c => {
    const span = document.createElement('span');
    span.className = 'cardchip';
    span.textContent = c;
    handDiv.appendChild(span);
  });
  setHidden(handArea, false);
}

createBtn.addEventListener('click', createRoom);
joinBtn.addEventListener('click', joinRoom);
saveNameBtn.addEventListener('click', setName);
dealBtn.addEventListener('click', () => {
  socket.emit('start-deal', { roomId: ROOM_ID, cardsPerPlayer: parseInt(cpp.value || '6', 10) });
});
revealBtn.addEventListener('click', () => {
  socket.emit('reveal-my-hand', { roomId: ROOM_ID });
});

// Socket events
socket.on('error-message', (msg) => alert(msg));

socket.on('room-state', (state) => {
  renderPlayers(state);
});
socket.on('your-hand', (cards) => {
  renderHand(cards);
});
socket.on('round-started', (data) => {
  setHidden(roundInfo, false);
  roundSummary.innerHTML = data.players.map(p => `<div class="badge">${p.name}: ${p.count} cards</div>`).join('');
  reveals.innerHTML = '';
});
socket.on('hand-revealed', (payload) => {
  const div = document.createElement('div');
  div.className = 'badge';
  div.textContent = `${payload.name} revealed: ${payload.hand.join(', ')}`;
  reveals.appendChild(div);
});

// Initialize
const storedName = localStorage.getItem('mlb_name');
if (storedName) nameInput.value = storedName;
if (ROOM_ID) {
  joinRoom();
} else {
  updateShareUrl();
}