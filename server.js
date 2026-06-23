const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['polling', 'websocket']
});

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
      state: { level: 0, keys: [], deaths: 0 }
    };
    socket.roomCode = code;
    socket.playerIndex = 0;
    socket.join(code);
    socket.emit('roomCreated', { code, playerIndex: 0 });
    console.log(`[SERVER] 🏠 Room ${code} created by ${socket.id}`);
  });

  socket.on('joinRoom', (code) => {
    console.log(`[SERVER] 📥 Join attempt for code: ${code} by ${socket.id}`);
    code = (code || '').toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      console.warn(`[SERVER] ❌ Room ${code} not found!`);
      socket.emit('joinError', 'Room not found! Check the code.');
      return;
    }
    if (room.players.length >= 2) {
      console.warn(`[SERVER] ❌ Room ${code} is full!`);
      socket.emit('joinError', 'Room is full!');
      return;
    }

    room.players.push(socket.id);
    socket.roomCode = code;
    socket.playerIndex = 1;

    socket.join(code);
    socket.emit('roomJoined', { code, playerIndex: 1 });

    setTimeout(() => {
      io.to(code).emit('bothReady', { level: room.state.level });
      console.log(`[SERVER] 🤝 Player 2 (${socket.id}) joined room ${code}. Game starting!`);
    }, 100);
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

  socket.on('collectCoin', (id) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    if (room) {
      io.to(socket.roomCode).emit('coinSync', id);
    }
  });

  socket.on('plateState', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('plateSync', data);
  });

  // Push block position sync
  socket.on('pushBlock', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('pushBlockSync', data);
  });

  // Falling platform state sync
  socket.on('fallingPlatform', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('fallingPlatformSync', data);
  });

  // Death event sync
  socket.on('playerDeath', () => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    if (room) {
      room.state.deaths++;
      io.to(socket.roomCode).emit('deathSync', { playerIndex: socket.playerIndex, totalDeaths: room.state.deaths });
    }
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
      const room = rooms[socket.roomCode];
      room.players = room.players.filter(id => id !== socket.id);
      socket.to(socket.roomCode).emit('partnerLeft');

      console.log(`🐻 Player left room ${socket.roomCode}. Remaining: ${room.players.length}`);

      if (room.players.length === 0) {
        delete rooms[socket.roomCode];
        console.log(`🗑️ Room ${socket.roomCode} deleted (empty)`);
      }
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

// Export for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
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
} else {
  console.log('🚀 Running in Serverless Mode (Vercel)');
}
