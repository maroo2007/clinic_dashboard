const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');

let io;

/**
 * Initialize Socket.io on an existing HTTP server.
 * Called once from src/index.js.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication for socket connections
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1] ||
      socket.handshake.query?.token;

    if (!token) return next(new Error('Authentication required'));

    try {
      socket.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role, clinic_id } = socket.user;

    if (role === 'SUPER_ADMIN') {
      socket.join('admin');
      console.log(`[SOCKET] Admin #${id} connected — socket ${socket.id}`);
    } else {
      const room = `clinic_${clinic_id}`;
      socket.join(room);
      console.log(`[SOCKET] Clinic #${clinic_id} user #${id} connected — socket ${socket.id}`);
    }

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected — socket ${socket.id}`);
    });
  });

  console.log('[SOCKET] Socket.io ready');
  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized — call initSocket() first');
  return io;
}

/**
 * Emit an event to a specific clinic's room.
 * Also broadcasts to the admin room so SUPER_ADMIN sees everything.
 *
 * @param {number} clinic_id
 * @param {string} event       e.g. 'appointment:new', 'message:new', 'patient:new'
 * @param {object} data
 */
function emitToClinic(clinic_id, event, data) {
  if (!io) return;
  // Clinic-specific room
  io.to(`clinic_${clinic_id}`).emit(event, data);
  // Admin room (always receives all events, enriched with clinic_id)
  io.to('admin').emit(event, { ...data, clinic_id });
}

module.exports = { initSocket, getIo, emitToClinic };
