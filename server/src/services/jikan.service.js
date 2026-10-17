import axios from 'axios';
import NodeCache from 'node-cache';

// Keep AniList access behind this service so caching, validation, and
// response normalization stay under server control.
const cache = new NodeCache();

const ANILIST_URL = 'https://graphql.anilist.co';


// AniList scores are 0-100; normalize them to the 0-10 scale used by the
// existing frontend.
const normalizeAniList = (media) => ({
  id: media.id,
  title: media.title?.english || media.title?.romaji || media.title?.native,
  imageUrl: media.coverImage?.large || media.coverImage?.medium || null,
  score: media.averageScore ? media.averageScore / 10 : null,
  genres: media.genres || [],
  year: media.seasonYear || null,
  season: media.season || null,
  format: media.format || null,
  status: media.status || null,
  episodes: media.episodes || null,
  duration: media.duration || null,
});

const animePageQuery = `
  query (
    $page: Int,
    $perPage: Int,
    $search: String,
    $genre: String,
    $seasonYear: Int,
    $season: MediaSeason,
    $format: MediaFormat,
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
      }

      media(
        type: ANIME,
        search: $search,
        genre: $genre,
        seasonYear: $seasonYear,
        season: $season,
        format: $format,
        sort: $sort
      ) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          large
          medium
        }
        averageScore
        genres
        seasonYear
        season
        format
        status
        episodes
        duration
      }
    }
  }
`;


const queryAniList = async (variables) => {
  const response = await axios.post(
    ANILIST_URL,
    {
      query: animePageQuery,
      variables,
    },
    {
      timeout: 10000,
      family: 4,
    }
  );

  if (response.data.errors?.length) {
    const error = new Error(response.data.errors[0].message);
    error.status = 502;
    throw error;
  }

  const page = response.data.data?.Page;

  if (!page) {
    const error = new Error('AniList returned an invalid response.');
    error.status = 502;
    throw error;
  }

  return {
    results: page.media.map(normalizeAniList),
    hasNextPage: page.pageInfo.hasNextPage,
  };
};

const normalizePage = (page) => Math.max(Number.parseInt(page, 10) || 1, 1);

const normalizeOptionalYear = (year) => {
  if (year === undefined || year === '') return undefined;

  const parsed = Number.parseInt(year, 10);

  if (!Number.isInteger(parsed) || parsed < 1980 || parsed > new Date().getFullYear()) {
    const error = new Error('Year must be between 1980 and the current year.');
    error.status = 400;
    throw error;
  }

  return parsed;
};

const ALLOWED_SEASONS = new Set([
  'WINTER',
  'SPRING',
  'SUMMER',
  'FALL',
]);

const ALLOWED_FORMATS = new Set([
  'TV',
  'MOVIE',
  'TV_SHORT',
  'SPECIAL',
  'OVA',
  'ONA',
  'MUSIC',
]);


export const getTopAnime = async (
  page = 1,
  {
    genre,
    year,
    season,
    format,
  } = {}
) => {
  const normalizedPage = normalizePage(page);
  const normalizedYear = normalizeOptionalYear(year);

  if (season && !ALLOWED_SEASONS.has(season)) {
    const error = new Error('Invalid season.');
    error.status = 400;
    throw error;
  }

  if (format && !ALLOWED_FORMATS.has(format)) {
    const error = new Error('Invalid format.');
    error.status = 400;
    throw error;
  }

  const cacheKey = JSON.stringify({
    page: normalizedPage,
    genre: genre || null,
    year: normalizedYear || null,
    season: season || null,
    format: format || null,
  });

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await queryAniList({
      page: normalizedPage,
      perPage: 25,
      genre: genre || undefined,
      seasonYear: normalizedYear,
      season: season || undefined,
      format: format || undefined,
      sort: ['SCORE_DESC'],
    });

    cache.set(cacheKey, result, 900);
    return result;
  } catch (error) {
    console.error('[anilist] getTopAnime failed:', error.message);
    throw error;
  }
};

export const searchAnime = async (query) => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  try {
    const result = await queryAniList({
      page: 1,
      perPage: 20,
      search: trimmedQuery,
      sort: ['SEARCH_MATCH'],
    });

    return result.results;
  } catch (error) {
    console.error('[anilist] searchAnime failed:', error.message);
    throw error;
  }
};

export const getTrendingAnime = async () => {
  const cacheKey = 'trending:anilist';
  const cached = cache.get(cacheKey);

  if (cached) return cached;

  try {
    const result = await queryAniList({
      page: 1,
      perPage: 20,
      sort: ['TRENDING_DESC'],
    });

    cache.set(cacheKey, result.results, 900);
    return result.results;
  } catch (error) {
    console.error('[anilist] getTrendingAnime failed:', error.message);
    throw error;
  }
};

export const getAnimeByGenre = async (
  genreName,
  _unusedGenreId,
  page = 1,
  filters = {}
) => {
  return getTopAnime(page, {
    ...filters,
    genre: genreName,
  });
};

// Pre-populate the cache for the pages almost every visitor will hit
// (enough for Top 50, the largest option in the UI).
export const warmTopAnimeCache = async () => {
  for (const page of [1, 2]) {
    try {
      await getTopAnime(page);
      console.log(`[anilist] warmed cache for top-anime page ${page}`);
    } catch (err) {
      console.warn(`[anilist] cache warm-up failed for page ${page}:`, err.message);
    }
  }
};