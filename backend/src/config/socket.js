import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server configuration error'));
      }

      const payload = jwt.verify(token, secret);
      const user = await User.findById(payload.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token expired'));
      } else if (error.name === 'JsonWebTokenError') {
        return next(new Error('Authentication error: Invalid token'));
      }
      return next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket.io: User connected - ${socket.userId}`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      console.log(`❌ Socket.io: User disconnected - ${socket.userId}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket.io error:', error);
    });
  });

  return io;
};

/**
 * Emit notification to a specific user
 * @param {Object} io - Socket.io server instance
 * @param {string} userId - User ID
 * @param {Object} notification - Notification object
 */
export const emitNotification = (io, userId, notification) => {
  if (!io) {
    console.warn('Socket.io not initialized, skipping real-time notification');
    return;
  }

  try {
    io.to(`user:${userId}`).emit('notification', notification);
    console.log(`📢 Notification emitted to user: ${userId}`);
  } catch (error) {
    console.error('Error emitting notification:', error);
  }
};

/**
 * Emit unread count update to a specific user
 * @param {Object} io - Socket.io server instance
 * @param {string} userId - User ID
 * @param {number} unreadCount - Unread notification count
 */
export const emitUnreadCount = (io, userId, unreadCount) => {
  if (!io) {
    return;
  }

  try {
    io.to(`user:${userId}`).emit('unread_count', { unreadCount });
  } catch (error) {
    console.error('Error emitting unread count:', error);
  }
};

export default { initializeSocket, emitNotification, emitUnreadCount };


