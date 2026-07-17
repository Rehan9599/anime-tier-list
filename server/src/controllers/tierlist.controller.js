import TierList from '../models/TierList.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendTierListEmail } from '../services/email.service.js';
import { getTopAnime } from '../services/jikan.service.js';
import { recommend } from '../services/recommend.service.js';

export const getTierList = asyncHandler(async (req, res) => {
  const category = req.query.category || 'anime';
  let tierList = await TierList.findOne({ userId: req.userId, category });
  if (!tierList) {
    tierList = await TierList.create({ userId: req.userId, category });
  }
  res.json({ tierList });
});

// Frontend always sends the *complete* current state of all four tiers,
// not a diff -- keeps this endpoint simple and safe against out-of-order
// autosave requests.
export const saveTierList = asyncHandler(async (req, res) => {
  const { category = 'anime', tiers } = req.body;
  if (!tiers) return res.status(400).json({ message: 'tiers object is required' });

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
