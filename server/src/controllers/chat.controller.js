import Message from '../models/Message.js';
import { areFriends, orderPair } from '../utils/friendship.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

export const getHistory = asyncHandler(async (req, res) => {
  const { friendId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    return res.status(400).json({ message: 'Invalid friend ID.' });
  }

  if (!(await areFriends(req.userId, friendId))) {
    return res.status(403).json({ message: 'You can only chat with friends.' });
  }

  const conversationId = orderPair(req.userId, friendId).join('_');
  const messages = await Message.find({ conversationId }).sort({ createdAt: -1 }).limit(200);
  messages.reverse(); 
  res.json({
    messages: messages.map((m) => ({
      id: m._id,
      from: String(m.from),
      text: m.text,
      createdAt: m.createdAt,
    })),
  });
});
