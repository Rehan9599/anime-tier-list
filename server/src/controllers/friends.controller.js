import Friendship from '../models/Friendship.js';
import FriendRequest from '../models/FriendRequest.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Normalizes a pair of user ids into a consistent order so (A,B) and (B,A)
// are always the same document -- required for Friendship's unique index
// to actually prevent duplicate/reversed friendships.
const orderPair = (id1, id2) => [String(id1), String(id2)].sort();

const areFriends = async (id1, id2) => {
  const [userA, userB] = orderPair(id1, id2);
  return Friendship.exists({ userA, userB });
};

// Search by username, annotated with the current relationship so the
// frontend can show the right button (Add / Pending / Friends) without a
// second round trip.
export const searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ users: [] });

  const matches = await User.find({
    username: { $regex: q, $options: 'i' },
    _id: { $ne: req.userId },
  })
    .select('username')
    .limit(10);

  const [friendships, outgoing, incoming] = await Promise.all([
    Friendship.find({ $or: [{ userA: req.userId }, { userB: req.userId }] }),
    FriendRequest.find({ from: req.userId }),
    FriendRequest.find({ to: req.userId }),
  ]);

  const friendIds = new Set(
    friendships.map((f) => (String(f.userA) === String(req.userId) ? String(f.userB) : String(f.userA)))
  );
  const outgoingIds = new Set(outgoing.map((r) => String(r.to)));
  const incomingIds = new Set(incoming.map((r) => String(r.from)));

  const users = matches.map((u) => ({
    id: u._id,
    username: u.username,
    status: friendIds.has(String(u._id))
      ? 'friends'
      : outgoingIds.has(String(u._id))
      ? 'pending_sent'
      : incomingIds.has(String(u._id))
      ? 'pending_received'
      : 'none',
  }));

  res.json({ users });
});

export const sendRequest = asyncHandler(async (req, res) => {
  const { userId: toUserId } = req.body;
  if (!toUserId) return res.status(400).json({ message: 'A user to add is required.' });
  if (String(toUserId) === String(req.userId)) {
    return res.status(400).json({ message: "You can't add yourself as a friend." });
  }

  const targetUser = await User.findById(toUserId);
  if (!targetUser) return res.status(404).json({ message: 'User not found.' });

  if (await areFriends(req.userId, toUserId)) {
    return res.status(400).json({ message: 'You are already friends.' });
  }

  // If they already sent YOU a request, accept it instead of creating a
  // second, redundant request in the other direction.
  const reverseRequest = await FriendRequest.findOne({ from: toUserId, to: req.userId });
  if (reverseRequest) {
    const [userA, userB] = orderPair(req.userId, toUserId);
    await Friendship.create({ userA, userB });
    await FriendRequest.deleteOne({ _id: reverseRequest._id });
    return res.status(201).json({ message: `You're now friends with ${targetUser.username}.`, status: 'friends' });
  }

  try {
    await FriendRequest.create({ from: req.userId, to: toUserId });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Request already sent.' });
    throw err;
  }

  res.status(201).json({ message: `Friend request sent to ${targetUser.username}.`, status: 'pending_sent' });
});

export const listIncomingRequests = asyncHandler(async (req, res) => {
  const requests = await FriendRequest.find({ to: req.userId }).populate('from', 'username');
  res.json({
    requests: requests.map((r) => ({ id: r._id, from: { id: r.from._id, username: r.from.username } })),
  });
});

export const respondToRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { accept } = req.body; // boolean

  const request = await FriendRequest.findById(requestId);
  if (!request || String(request.to) !== String(req.userId)) {
    return res.status(404).json({ message: 'Request not found.' });
  }

  if (accept) {
    const [userA, userB] = orderPair(request.from, request.to);
    await Friendship.findOneAndUpdate({ userA, userB }, { userA, userB }, { upsert: true });
  }
  await FriendRequest.deleteOne({ _id: request._id });

  res.json({ message: accept ? 'Friend request accepted.' : 'Friend request declined.' });
});

export const listFriends = asyncHandler(async (req, res) => {
  const userId = String(req.userId);
  const friendships = await Friendship.find({ $or: [{ userA: userId }, { userB: userId }] });

  const friendIds = friendships.map((f) => (String(f.userA) === userId ? f.userB : f.userA));
  const friends = await User.find({ _id: { $in: friendIds } }).select('username');

  res.json({ friends: friends.map((f) => ({ id: f._id, username: f.username })) });
});
