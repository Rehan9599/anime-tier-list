import { getTopAnime, searchAnime } from '../services/jikan.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const top = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const { results, hasNextPage } = await getTopAnime(page);
  res.json({ results, hasNextPage, page });
});

export const search = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const results = await searchAnime(q.trim());
  res.json({ results });
});
