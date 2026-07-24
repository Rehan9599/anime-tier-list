import crypto from 'node:crypto';
import CommunitySession from '../models/CommunitySession.js';
import { areFriends } from '../utils/friendship.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Excludes visually ambiguous characters (0/O, 1/I) since this code gets
// read off one screen and typed into another.
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateRoomCode = () => {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_CODE_CHARS[crypto.randomInt(0, ROOM_CODE_CHARS.length)];
  return code;
};

export const createSession = asyncHandler(async (req, res) => {
  const { friendId, category = 'anime' } = req.body;
  if (!friendId) return res.status(400).json({ message: 'A friend is required to start a shared list.' });
  if (!(await areFriends(req.userId, friendId))) {
    return res.status(403).json({ message: 'You can only start a shared list with a friend.' });
  }

  let roomCode = null;
  for (let attempt = 0; attempt < 5 && !roomCode; attempt++) {
    const candidate = generateRoomCode();
    const existing = await CommunitySession.findOne({ roomCode: candidate });
    if (!existing) roomCode = candidate;
  }
  if (!roomCode) return res.status(500).json({ message: 'Could not create a session, please try again.' });

  const session = await CommunitySession.create({
    roomCode,
    category,
    participants: [req.userId, friendId],
  });

  res.status(201).json({ roomCode: session.roomCode });
});

export const getSession = asyncHandler(async (req, res) => {
  const { roomCode } = req.params;
  const session = await CommunitySession.findOne({ roomCode }).populate('participants', 'username');
  if (!session) return res.status(404).json({ message: 'Session not found.' });

  const isParticipant = session.participants.some((p) => String(p._id) === String(req.userId));
  if (!isParticipant) return res.status(403).json({ message: 'You are not a participant in this session.' });

  res.json({
    roomCode: session.roomCode,
    tiers: session.tiers,
    participants: session.participants.map((p) => ({ id: p._id, username: p.username })),
  });
});
