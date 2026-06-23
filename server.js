const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('🐻 Connected:', socket.id);

  socket.on('createRoom', () => {
    const code = genCode();
    rooms[code] = {
      code,
      players: [socket.id],
      state: { level: 0, keys: [] }
    };
    socket.roomCode = code;
    socket.playerIndex = 0;
    socket.join(code);
    socket.emit('roomCreated', { code, playerIndex: 0 });
    console.log(`Room ${code} created`);
  });

  socket.on('joinRoom', (code) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms[code];
    if (!room) { socket.emit('joinError', 'Room not found! Check the code.'); return; }
    if (room.players.length >= 2) { socket.emit('joinError', 'Room is full!'); return; }
    room.players.push(socket.id);
    socket.roomCode = code;
    socket.playerIndex = 1;
    socket.join(code);
    socket.emit('roomJoined', { code, playerIndex: 1 });
    io.to(code).emit('bothReady');
    console.log(`Player 2 joined room ${code}`);
  });

  socket.on('playerState', (state) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('remoteState', { playerIndex: socket.playerIndex, ...state });
  });

  socket.on('collectKey', (id) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    if (room && !room.state.keys.includes(id)) {
      room.state.keys.push(id);
      io.to(socket.roomCode).emit('keySync', id);
    }
  });

  socket.on('plateState', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('plateSync', data);
  });

  socket.on('nextLevel', (lvIndex) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    if (room) {
      room.state.level = lvIndex;
      room.state.keys = [];
      io.to(socket.roomCode).emit('loadLevel', lvIndex);
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomCode && rooms[socket.roomCode]) {
      socket.to(socket.roomCode).emit('partnerLeft');
      delete rooms[socket.roomCode];
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let lanIP = 'localhost';
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) { lanIP = iface.address; break; }
    }
    if (lanIP !== 'localhost') break;
  }
  console.log('\n🐻💕 Dudu & Bubu Adventure Server');
  console.log(`✅ Local:  http://localhost:${PORT}`);
  console.log(`🌐 LAN:   http://${lanIP}:${PORT}  ← Share this with Player 2!\n`);
});
