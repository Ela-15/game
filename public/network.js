'use strict';
// ═══════════════════════════════════════════════════════════════
//  NETWORK — Socket.io client layer for Dudu & Bubu
// ═══════════════════════════════════════════════════════════════

const socket = io();

// ── Lobby UI ───────────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  console.log('Attempting to create room...');
  socket.emit('createRoom');
});

document.getElementById('btn-join').addEventListener('click', () => {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code || code.length < 4) {
    showError('Please enter a valid 4-letter room code!');
    return;
  }
  document.getElementById('btn-join').disabled = true;
  document.getElementById('btn-join').textContent = 'Joining...';
  socket.emit('joinRoom', code);

  // Auto-reset if no response in 5s
  setTimeout(() => {
    if (document.getElementById('btn-join').disabled && document.getElementById('btn-join').textContent === 'Joining...') {
      document.getElementById('btn-join').disabled = false;
      document.getElementById('btn-join').textContent = 'Join Room';
      showError('Connection timed out. Try again!');
    }
  }, 5000);
});

document.getElementById('room-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

function showError(msg) {
  const el = document.getElementById('join-error');
  el.textContent = msg;
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });
  setTimeout(() => { el.textContent = ''; }, 4000);
}

function showScene(name) {
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('scene-' + name);
  if (el) el.classList.add('active');
}

// ── Socket Events ──────────────────────────────────────────────
socket.on('roomCreated', ({ code, playerIndex }) => {
  _myPlayerIndex = playerIndex;
  document.getElementById('room-code-show').textContent = code;
  showScene('waiting');
  console.log(`Room created: ${code}, you are Player ${playerIndex + 1}`);
});

socket.on('roomJoined', ({ code, playerIndex }) => {
  console.log(`Joined room: ${code}, you are Player ${playerIndex + 1} (Bubu 🐻 white)`);
});

socket.on('joinError', (msg) => {
  document.getElementById('btn-join').disabled = false;
  document.getElementById('btn-join').textContent = 'Join Room';
  showError(msg);
});

let _pendingStart = null;
socket.on('bothReady', ({ level }) => {
  const idx = _myPlayerIndex;
  const startLevel = level || 0;
  if (window.onBothReady) {
    window.onBothReady(idx, startLevel);
  } else {
    _pendingStart = { idx, startLevel };
  }
});

window.NET_reportReady = () => {
  if (_pendingStart && window.onBothReady) {
    window.onBothReady(_pendingStart.idx, _pendingStart.startLevel);
    _pendingStart = null;
  }
};

socket.on('remoteState', (state) => {
  if (window.onRemoteState) window.onRemoteState(state);
});

socket.on('keySync', (id) => {
  if (window.onRemoteKey) window.onRemoteKey(id);
});

socket.on('plateSync', (data) => {
  if (window.onRemotePlate) window.onRemotePlate(data);
});

socket.on('coinSync', (id) => {
  if (window.onRemoteCoin) window.onRemoteCoin(id);
});

socket.on('loadLevel', (idx) => {
  if (window.onLoadLevel) window.onLoadLevel(idx);
});

socket.on('partnerLeft', () => {
  if (window.onPartnerLeft) window.onPartnerLeft();
});

socket.on('connect', () => {
  console.log('🌐 Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.warn('Disconnected from server');
});

// ── Track local player index ───────────────────────────────────
let _myPlayerIndex = 0;

socket.on('roomCreated', ({ playerIndex }) => { _myPlayerIndex = playerIndex; });
socket.on('roomJoined', ({ playerIndex }) => { _myPlayerIndex = playerIndex; });

// ── Send helpers (called by game.js) ───────────────────────────

// Send local bear state every frame
let _stateTick = 0;
window.NET_state = (state) => {
  _stateTick++;
  if (_stateTick % 2 !== 0) return; // Send every 2 frames (~30 Hz)
  socket.emit('playerState', state);
};

window.NET_key = (id) => {
  socket.emit('collectKey', id);
};

window.NET_plate = (data) => {
  socket.emit('plateState', data);
};

window.NET_coin = (id) => {
  socket.emit('collectCoin', id);
};

window.NET_nextLevel = (lvIndex) => {
  socket.emit('nextLevel', lvIndex);
};
