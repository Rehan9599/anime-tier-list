import Watchlist from '../models/Watchlist.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const addToWatchlist = asyncHandler(async (req, res) => {
  const { animeId, title, imageUrl, genres } = req.body;
  if (animeId == null || !title) {
    return res.status(400).json({ message: 'animeId and title are required.' });
  }

  await Watchlist.findOneAndUpdate(
    { userId: req.userId, animeId },
    { userId: req.userId, animeId, title, imageUrl, genres: genres || [] },
    { upsert: true, new: true }
  );

  res.json({ message: 'Added to watchlist.' });
});

export const listWatchlist = asyncHandler(async (req, res) => {
  const items = await Watchlist.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({
    items: items.map((i) => ({ animeId: i.animeId, title: i.title, imageUrl: i.imageUrl, genres: i.genres || [] })),
  });
});

export const removeFromWatchlist = asyncHandler(async (req, res) => {
  const { animeId } = req.params;
  await Watchlist.deleteOne({ userId: req.userId, animeId: Number(animeId) });
  res.json({ message: 'Removed from watchlist.' });
});