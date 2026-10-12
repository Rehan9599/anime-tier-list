import WatchedStatus from '../models/WatchedStatus.js';
import { getTopAnime } from '../services/jikan.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const PROMPT_SIZE = 10;
const MAX_PAGES = 8;
const PAGE_BATCH_SIZE = 4;

export const getPrompt = asyncHandler(async (req, res) => {
  const asked = await WatchedStatus.find({ userId: req.userId }).select('animeId');
  const askedIds = new Set(asked.map((a) => a.animeId));

  const candidates = [];
  const seenIds = new Set();
  let nextPage = 1;
  let hasNextPage = true;

  while (candidates.length < PROMPT_SIZE && hasNextPage && nextPage <= MAX_PAGES) {
    const pages = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, MAX_PAGES - nextPage + 1) },
      (_, index) => nextPage + index
    );
    const results = await Promise.allSettled(pages.map((page) => getTopAnime(page)));

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;

      hasNextPage = result.value.hasNextPage;
      for (const anime of result.value.results) {
        if (!askedIds.has(anime.id) && !seenIds.has(anime.id)) {
          seenIds.add(anime.id);
          candidates.push(anime);
        }
        if (candidates.length >= PROMPT_SIZE) break;
      }
    }

    nextPage += pages.length;
  }

  res.json({ items: candidates.slice(0, PROMPT_SIZE) });
});

export const submitStatus = asyncHandler(async (req, res) => {
  const { animeId, title, imageUrl, watched, genres } = req.body;
  if (animeId == null || !title || typeof watched !== 'boolean') {
    return res.status(400).json({ message: 'animeId, title, and watched are required.' });
  }

  await WatchedStatus.findOneAndUpdate(
    { userId: req.userId, animeId },
    { userId: req.userId, animeId, title, imageUrl, watched, genres: genres || [] },
    { upsert: true, new: true }
  );

  res.json({ message: 'Saved.' });
});

export const listWatched = asyncHandler(async (req, res) => {
  const items = await WatchedStatus.find({ userId: req.userId, watched: true }).sort({ createdAt: -1 });
  res.json({
    items: items.map((i) => ({
      animeId: i.animeId,
      title: i.title,
      imageUrl: i.imageUrl,
      genres: i.genres || [],
      watchedAt: i.createdAt,
    })),
  });
});