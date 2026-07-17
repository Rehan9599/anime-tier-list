import axios from 'axios';
import NodeCache from 'node-cache';

// Never call Jikan directly from the browser -- everything goes through
// this service so caching, retries, and rate limits stay under our control.
const cache = new NodeCache();
const JIKAN_URL = 'https://api.jikan.moe/v4';
const ANILIST_URL = 'https://graphql.anilist.co';

const normalizeJikan = (anime) => ({
  id: anime.mal_id,
  title: anime.title,
  imageUrl: anime.images?.jpg?.image_url,
  score: anime.score,
  genres: (anime.genres || []).map((g) => g.name),
});

// AniList scores are 0-100; Jikan/MAL scores are 0-10. Normalize to the
// same 0-10 scale so both sources are interchangeable to the frontend.
const normalizeAniList = (media) => ({
  id: media.id,
  title: media.title.english || media.title.romaji,
  imageUrl: media.coverImage?.large,
  score: media.averageScore ? media.averageScore / 10 : null,
  genres: media.genres || [],
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Jikan is an unofficial scraper in front of MyAnimeList and periodically
// loses its connection to MAL (503/504, "Jikan failed to connect to
// MyAnimeList"). This is a known, recurring issue on Jikan's side, not
// something wrong with our request -- a short retry with backoff clears
// most of these since the outages are usually seconds long.
const fetchWithRetry = async (url, params, retries = 1) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios.get(url, { params, timeout: 8000, family: 4 });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(400);
    }
  }
  throw lastErr;
};

const describeError = (err) =>
  err.response
    ? `responded ${err.response.status}: ${JSON.stringify(err.response.data)}`
    : `${err.code || 'ERROR'}: ${err.message}`;

// --- AniList fallback -------------------------------------------------
// AniList is a first-party GraphQL API (not a scraper), so it's the
// independent second source we fall back to when Jikan is degraded.
// A real Jikan outage and a real AniList outage happening at the same
// moment is very unlikely, which is the whole point of having two.

const topAnimeQuery = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(sort: SCORE_DESC, type: ANIME) {
        id
        title { romaji english }
        coverImage { large }
        averageScore
        genres
      }
    }
  }
`;

const searchAnimeQuery = `
  query ($search: String, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english }
        coverImage { large }
        averageScore
        genres
      }
    }
  }
`;

const queryAniList = async (query, variables) => {
  const { data } = await axios.post(
    ANILIST_URL,
    { query, variables },
    { timeout: 8000, family: 4 }
  );
  return data.data.Page.media.map(normalizeAniList);
};

// --- Public API ---------------------------------------------------------

// Jikan (and AniList) return a fixed page size, not an arbitrary "limit" --
// so top-anime is fetched by page, and the frontend accumulates pages to
// fill whatever display count (20/30/50) the user picked, backfilling as
// items get dragged out of the pool and into tiers.
export const getTopAnime = async (page = 1) => {
  const cacheKey = `top:page:${page}`;
  const staleKey = `${cacheKey}:stale`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await fetchWithRetry(`${JIKAN_URL}/top/anime`, { page });
    const result = {
      results: data.data.map(normalizeJikan),
      hasNextPage: data.pagination?.has_next_page ?? false,
    };
    cache.set(cacheKey, result, 3600); // 1 hour -- top rankings barely move minute to minute
    cache.set(staleKey, result, 86400); // keep a 24h fallback copy for outages
    return result;
  } catch (err) {
    console.error('[jikan] getTopAnime failed after retries:', describeError(err));

    try {
      const { data } = await axios.post(
        ANILIST_URL,
        { query: topAnimeQuery, variables: { page, perPage: 25 } },
        { timeout: 8000, family: 4 }
      );
      const result = {
        results: data.data.Page.media.map(normalizeAniList),
        hasNextPage: data.data.Page.pageInfo.hasNextPage,
      };
      cache.set(cacheKey, result, 900); // shorter TTL -- prefer to go back to Jikan once it recovers
      console.warn('[jikan] Jikan is down, served results from AniList instead');
      return result;
    } catch (aniListErr) {
      console.error('[anilist] fallback also failed:', describeError(aniListErr));
    }

    const stale = cache.get(staleKey);
    if (stale) {
      console.warn('[jikan] serving stale top-anime cache as last resort');
      return stale;
    }

    const friendly = new Error('Anime data source is temporarily unavailable. Please try again shortly.');
    friendly.status = 503;
    throw friendly;
  }
};

export const searchAnime = async (query) => {
  try {
    const { data } = await fetchWithRetry(`${JIKAN_URL}/anime`, { q: query, limit: 20 });
    return data.data.map(normalizeJikan);
  } catch (err) {
    console.error('[jikan] searchAnime failed after retries:', describeError(err));

    try {
      const results = await queryAniList(searchAnimeQuery, { search: query, perPage: 20 });
      console.warn('[jikan] Jikan is down, served search results from AniList instead');
      return results;
    } catch (aniListErr) {
      console.error('[anilist] fallback also failed:', describeError(aniListErr));
    }

    const friendly = new Error('Search is temporarily unavailable. Please try again shortly.');
    friendly.status = 503;
    throw friendly;
  }
};

// Pre-populate the cache for the pages almost every visitor will hit
// (enough for Top 50, the largest option in the UI) so the first real
// request of the hour reads from memory instead of waiting on a live
// Jikan/AniList round trip. Called once on server startup and refreshed
// periodically -- see server.js.
export const warmTopAnimeCache = async () => {
  for (const page of [1, 2]) {
    try {
      await getTopAnime(page);
      console.log(`[jikan] warmed cache for top-anime page ${page}`);
    } catch (err) {
      console.warn(`[jikan] cache warm-up failed for page ${page}:`, err.message);
    }
  }
};
