import Watchlist from '../models/Watchlist.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const addToWatchlist = asyncHandler(async (req, res) => {
  const {
    animeId,
    title,
    imageUrl,
    genres,
    year,
    season,
    format,
  } = req.body;
  const normalizedAnimeId = Number(animeId);
  if (!Number.isInteger(normalizedAnimeId) || normalizedAnimeId <= 0 || !title) {
    return res.status(400).json({ message: 'A valid animeId and title are required.' });
  }

  await Watchlist.findOneAndUpdate(
    { userId: req.userId, animeId: normalizedAnimeId },
    {
      userId: req.userId,
      animeId: normalizedAnimeId,
      title,
      imageUrl,
      genres: genres || [],
      year: year ?? null,
      season: season || null,
      format: format || null,
    },
    { upsert: true, new: true }
  );

  res.json({ message: 'Added to watchlist.' });
});

export const listWatchlist = asyncHandler(async (req, res) => {
  const items = await Watchlist.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({
    items: items.map((i) => ({
      animeId: i.animeId,
      title: i.title,
      imageUrl: i.imageUrl,
      genres: i.genres || [],
      year: i.year ?? null,
      season: i.season || null,
      format: i.format || null,
    })),
  });
});

export const removeFromWatchlist = asyncHandler(async (req, res) => {
  const { animeId } = req.params;
  const normalizedAnimeId = Number(animeId);
  if (!Number.isInteger(normalizedAnimeId) || normalizedAnimeId <= 0) {
    return res.status(400).json({ message: 'A valid animeId is required.' });
  }

  const result = await Watchlist.deleteOne({
    userId: req.userId,
    animeId: normalizedAnimeId,
  });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: 'Anime is not in your watchlist.' });
  }

  res.json({ message: 'Removed from watchlist.' });
});