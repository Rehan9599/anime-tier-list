import 'dotenv/config';
import dns from 'node:dns';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import animeRoutes from './routes/anime.routes.js';
import tierlistRoutes from './routes/tierlist.routes.js';
import friendsRoutes from './routes/friends.routes.js';
import chatRoutes from './routes/chat.routes.js';
import communityRoutes from './routes/community.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { warmTopAnimeCache } from './services/jikan.service.js';
import Message from './models/Message.js';
import CommunitySession from './models/CommunitySession.js';
import { areFriends, orderPair } from './utils/friendship.js';
import watchedRoutes from './routes/watched.routes.js';
import watchlistRoutes from './routes/watchlist.routes.js';
// ...

// Node defaults to trying IPv6 first for DNS lookups. On networks with
// broken/slow IPv6 routing this makes outbound calls (e.g. to Jikan) hang
// until they time out, even though curl -- which resolves IPv4 first --
// connects fine. Forcing IPv4-first here fixes that class of failure.
dns.setDefaultResultOrder('ipv4first');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/tierlist', tierlistRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/watched', watchedRoutes);
app.use('/api/watchlist', watchlistRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Socket.IO needs the raw http server, not the Express app directly --
// Express keeps working exactly as before, this just wraps it.
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

// Socket.IO doesn't go through Express's cookie-parser middleware, so the
// handshake cookie header is parsed manually here and verified the same
// way the REST `protect` middleware does.
io.use((socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = cookies.token;
    if (!token) return next(new Error('Not authenticated'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Not authenticated'));
  }
});

io.on('connection', (socket) => {
  // Joining is per-conversation, not automatic -- the client explicitly
  // asks to join once it knows which friend it's chatting with.
  socket.on('chat:join', async ({ friendId }) => {
    try {
      if (!friendId || !(await areFriends(socket.userId, friendId))) return;
      socket.join(orderPair(socket.userId, friendId).join('_'));
    } catch (err) {
      console.error('[socket] chat:join failed:', err.message);
    }
  });

  // The client calls this when switching away from a conversation (e.g.
  // navigating to a different friend) -- without it, the socket would
  // stay in the old room and could receive messages from a conversation
  // that's no longer open.
  socket.on('chat:leave', ({ friendId }) => {
    if (!friendId) return;
    socket.leave(orderPair(socket.userId, friendId).join('_'));
  });

  socket.on('chat:message', async ({ friendId, text }) => {
    try {
      if (!text || !text.trim() || !friendId) return;
      if (!(await areFriends(socket.userId, friendId))) return;

      const conversationId = orderPair(socket.userId, friendId).join('_');
      const message = await Message.create({
        conversationId,
        from: socket.userId,
        text: text.trim().slice(0, 1000),
      });

      // Broadcast to the whole room, including the sender -- the client
      // renders only from this event rather than optimistically echoing
      // its own message locally, which avoids duplicate-message bugs.
      io.to(conversationId).emit('chat:message', {
        id: message._id,
        from: String(message.from),
        text: message.text,
        createdAt: message.createdAt,
      });
    } catch (err) {
      console.error('[socket] chat:message failed:', err.message);
    }
  });

  // --- Shared community tier board -------------------------------------
  // Each participant runs their own local drag-and-drop (their own
  // DndContext, in their own browser) -- only the *resulting* tiers state
  // needs to sync between them, not the drag gesture itself. Same
  // broadcast-to-everyone-including-sender pattern as chat, for the same
  // reason: the client renders only from this event, never from a local
  // optimistic update, so there's no merge-conflict logic to get wrong.
  socket.on('session:join', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const session = await CommunitySession.findOne({ roomCode });
      if (!session) return;
      const isParticipant = session.participants.some((p) => String(p) === String(socket.userId));
      if (!isParticipant) return;
      socket.join(`session:${roomCode}`);
    } catch (err) {
      console.error('[socket] session:join failed:', err.message);
    }
  });

  socket.on('session:leave', ({ roomCode }) => {
    if (!roomCode) return;
    socket.leave(`session:${roomCode}`);
  });

  socket.on('session:update', async ({ roomCode, tiers }) => {
    try {
      if (!roomCode || !tiers) return;
      const session = await CommunitySession.findOne({ roomCode });
      if (!session) return;
      const isParticipant = session.participants.some((p) => String(p) === String(socket.userId));
      if (!isParticipant) return;

      session.tiers = tiers;
      await session.save();

      io.to(`session:${roomCode}`).emit('session:update', { tiers });
    } catch (err) {
      console.error('[socket] session:update failed:', err.message);
    }
  });
});

connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  // Warm the cache immediately so the first real request doesn't wait on
  // a live Jikan/AniList round trip, then keep it warm just under the
  // 1-hour cache TTL so it never fully goes cold during normal use.
  warmTopAnimeCache();
  setInterval(warmTopAnimeCache, 50 * 60 * 1000);
});