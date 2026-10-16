const history = {}; // roomName -> last 50 messages (in memory)

module.exports = function chat(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', ({ room, username }) => {
      if (!room || !username) return;
      const previous = socket.data.room;
      socket.data.username = username;
      if (previous) { socket.leave(previous); emitCount(io, previous); }
      socket.data.room = room;
      socket.join(room);
      socket.emit('history', history[room] || []);
      io.to(room).emit('system', { text: `${username} joined #${room}`, at: Date.now() });
      emitCount(io, room);
    });

    socket.on('send_message', ({ text }) => {
      const { room, username } = socket.data;
      if (!room || !text || !text.trim()) return;
      const msg = { username, text: text.trim().slice(0, 500), at: Date.now() };
      (history[room] = history[room] || []).push(msg);
      if (history[room].length > 50) history[room].shift();
      io.to(room).emit('message', msg);
    });

    socket.on('typing', () => {
      const { room, username } = socket.data;
      if (room) socket.to(room).emit('typing', username);
    });

    socket.on('disconnect', () => {
      const { room, username } = socket.data;
      if (room) {
        io.to(room).emit('system', { text: `${username} left #${room}`, at: Date.now() });
        emitCount(io, room);
      }
    });
  });
};

async function emitCount(io, room) {
  const sockets = await io.in(room).fetchSockets();
  io.to(room).emit('room_users', { room, count: sockets.length });
}
