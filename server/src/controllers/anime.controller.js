import { getTopAnime, searchAnime, getTrendingAnime, getAnimeByGenre } from '../services/jikan.service.js';
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
 
export const trending = asyncHandler(async (req, res) => {
  const results = await getTrendingAnime();
  res.json({ results });
});
 
// Standard MAL genre taxonomy IDs, used for the Jikan-primary lookup.
// AniList's fallback uses the plain genre name string instead of an ID,
// so even if one of these IDs is subtly wrong, the fallback still works
// correctly -- this degrades gracefully rather than breaking silently.
const GENRE_MAP = {
  action: 1,
  adventure: 2,
  comedy: 4,
  drama: 8,
  fantasy: 10,
  horror: 14,
  mystery: 7,
  romance: 22,
  'sci-fi': 24,
  'slice of life': 36,
  sports: 30,
  supernatural: 37,
};
 
export const genreList = (req, res) => {
  res.json({ genres: Object.keys(GENRE_MAP) });
};
 
export const byGenre = asyncHandler(async (req, res) => {
  const genre = (req.query.genre || '').toLowerCase().trim();
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const jikanGenreId = GENRE_MAP[genre];
 
  if (!jikanGenreId) {
    return res.status(400).json({ message: 'Unknown or missing genre.' });
  }
 
  const { results, hasNextPage } = await getAnimeByGenre(genre, jikanGenreId, page);
  res.json({ results, hasNextPage, page });
});