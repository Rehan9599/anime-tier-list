import TierList from '../models/TierList.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendTierListEmail } from '../services/email.service.js';

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
