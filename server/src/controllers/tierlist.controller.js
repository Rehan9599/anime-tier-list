import TierList from '../models/TierList.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendTierListEmail } from '../services/email.service.js';
import { getTopAnime } from '../services/jikan.service.js';
import { recommend } from '../services/recommend.service.js';
import { areFriends } from '../utils/friendship.js';
import mongoose from 'mongoose';

const TIER_NAMES = ['S', 'A', 'B', 'C'];
const MAX_ITEMS_PER_TIER = 60;
const MAX_TOTAL_ITEMS = 240;


const validateTiers = (tiers) => {
  if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) {
    return 'tiers must be an object';
  }
  const seenAnimeIds = new Set();
  const unexpectedTiers = Object.keys(tiers).filter((key) => !TIER_NAMES.includes(key));
  if (unexpectedTiers.length) {
    return 'tiers contains an unsupported tier';
  }

  let totalItems = 0;

  for (const tierName of TIER_NAMES) {
    const items = tiers[tierName];

    if (!Array.isArray(items)) {
      return `${tierName} tier must be an array`;
    }

    if (items.length > MAX_ITEMS_PER_TIER) {
      return `${tierName} tier cannot contain more than ${MAX_ITEMS_PER_TIER} items`;
    }

    totalItems += items.length;

    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return `${tierName} tier contains an invalid item`;
      }

      if (!Number.isInteger(item.animeId) || item.animeId < 1) {
        return `${tierName} tier contains an invalid animeId`;
      }

      if (typeof item.title !== 'string' || item.title.trim().length === 0 || item.title.length > 200) {
        return `${tierName} tier contains an invalid title`;
      }

      if (item.imageUrl !== undefined && typeof item.imageUrl !== 'string') {
        return `${tierName} tier contains an invalid imageUrl`;
      }

      if (item.genres !== undefined) {
        if (
          !Array.isArray(item.genres) ||
          item.genres.length > 30 ||
          item.genres.some((genre) => typeof genre !== 'string' || genre.length > 80)
        ) {
          return `${tierName} tier contains invalid genres`;
        }
      }
      if (
        item.year !== undefined &&
        item.year !== null &&
        (
          !Number.isInteger(item.year) ||
          item.year < 1980 ||
          item.year > new Date().getFullYear()
        )
      ) {
        return `${tierName} tier contains an invalid year`;
      }

      if (
        item.season !== undefined &&
        item.season !== null &&
        !['WINTER', 'SPRING', 'SUMMER', 'FALL'].includes(item.season)
      ) {
        return `${tierName} tier contains an invalid season`;
      }

      if (
        item.format !== undefined &&
        item.format !== null &&
        !['TV', 'MOVIE', 'TV_SHORT', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'].includes(item.format)
      ) {
        return `${tierName} tier contains an invalid format`;
      }

      if (
        item.score !== undefined &&
        item.score !== null &&
        (typeof item.score !== 'number' || item.score < 0 || item.score > 10)
      ) {
        return `${tierName} tier contains an invalid score`;
      }
      if (seenAnimeIds.has(item.animeId)) {
        return 'An anime cannot appear more than once in a tier list';
      }

      seenAnimeIds.add(item.animeId);
    }
  }

  if (totalItems > MAX_TOTAL_ITEMS) {
    return `A tier list cannot contain more than ${MAX_TOTAL_ITEMS} items`;
  }

  return null;
};


export const getTierList = asyncHandler(async (req, res) => {
  const category = req.query.category || 'anime';
  const tierList = await TierList.findOne({ userId: req.userId, category });
  const responseTierList = tierList || {
    userId: req.userId,
    category,
    tiers: { S: [], A: [], B: [], C: [] },
  };
  res.json({ tierList: responseTierList });
});

export const getFriendTierList = asyncHandler(async (req, res) => {
  const { friendId } = req.params;
  const category = req.query.category || 'anime';

  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    return res.status(400).json({ message: 'Invalid friend ID.' });
  }

  if (friendId !== String(req.userId) && !(await areFriends(req.userId, friendId))) {
    return res.status(403).json({ message: 'You can only view a friend’s tier list.' });
  }

  const friend = await User.findById(friendId);
  if (!friend) return res.status(404).json({ message: 'Friend not found' });

  const tierList = await TierList.findOne({ userId: friendId, category });
  const tiers = tierList?.tiers || { S: [], A: [], B: [], C: [] };

  res.json({ friendUsername: friend.username, tiers });
});

// Frontend always sends the *complete* current state of all four tiers,
// not a diff -- keeps this endpoint simple and safe against out-of-order
// autosave requests.
export const saveTierList = asyncHandler(async (req, res) => {
  const { category = 'anime', tiers } = req.body;
  if (!tiers) return res.status(400).json({ message: 'tiers object is required' });

  if (category !== 'anime') {
    return res.status(400).json({ message: 'Unsupported category.' });
  }

  const validationError = validateTiers(tiers);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const tierList = await TierList.findOneAndUpdate(
    { userId: req.userId, category },
    { tiers },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ tierList });
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 5;

export const emailTierList = asyncHandler(async (req, res) => {
  const category = req.body.category || 'anime';
  const tierList = await TierList.findOne({ userId: req.userId, category });
  if (!tierList) return res.status(404).json({ message: 'No tier list found to send' });

  const user = await User.findById(req.userId);

  // `recipients` is optional -- defaults to the logged-in user's own email.
  // Accepts either an array or a comma-separated string from the client.
  let recipients = [user.email];
  if (req.body.recipients) {
    const raw = Array.isArray(req.body.recipients)
      ? req.body.recipients
      : String(req.body.recipients).split(',');
    const cleaned = [...new Set(raw.map((e) => e.trim()).filter(Boolean))];

    if (cleaned.length > MAX_RECIPIENTS) {
      return res.status(400).json({ message: `You can send to at most ${MAX_RECIPIENTS} email addresses at once.` });
    }
    const invalid = cleaned.filter((e) => !EMAIL_REGEX.test(e));
    if (invalid.length) {
      return res.status(400).json({ message: `Invalid email address(es): ${invalid.join(', ')}` });
    }
    recipients = cleaned;
  }

  await sendTierListEmail(recipients, user.username, tierList.tiers);
  res.json({ message: `Tier list sent to ${recipients.join(', ')}` });
});

// Content-based recommendations: builds a taste profile from the user's
// S/A tier picks (see recommend.service.js for the actual vector math),
// then ranks a top-30 candidate pool -- with anything already placed in
// any tier excluded -- and returns the 5 closest matches.
export const getRecommendations = asyncHandler(async (req, res) => {
  const category = req.query.category || 'anime';
  const tierList = await TierList.findOne({ userId: req.userId, category });

  if (!tierList || (tierList.tiers.S.length === 0 && tierList.tiers.A.length === 0)) {
    return res.status(400).json({
      message: 'Rank a few anime in S or A tier first so we have something to base recommendations on.',
    });
  }

  const placedIds = new Set();
  ['S', 'A', 'B', 'C'].forEach((t) => tierList.tiers[t].forEach((a) => placedIds.add(a.animeId)));

  // "Top 30" candidate pool, matching the browse UI's own Top 30 option --
  // two pages, deduplicated, with already-placed anime filtered out.
  const [page1, page2] = await Promise.all([getTopAnime(1), getTopAnime(2)]);
  const seen = new Set();
  const candidates = [];
  [...page1.results, ...page2.results].forEach((a) => {
    if (!seen.has(a.id) && !placedIds.has(a.id)) {
      seen.add(a.id);
      candidates.push(a);
    }
  });

  const { recommendations, basedOnGenres } = recommend(tierList.tiers, candidates.slice(0, 30), 5);
  res.json({ recommendations, basedOnGenres });
});
