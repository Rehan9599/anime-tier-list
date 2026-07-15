import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import animeRoutes from './routes/anime.routes.js';
import tierlistRoutes from './routes/tierlist.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});


          
          