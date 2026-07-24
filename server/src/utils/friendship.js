import Friendship from '../models/Friendship.js';

// Normalizes a pair of user ids into a consistent order so (A,B) and (B,A)
// are always the same document/room -- required for Friendship's unique
// index, and reused for chat conversation ids so both directions map to
// the same conversation.
export const orderPair = (id1, id2) => [String(id1), String(id2)].sort();

export const areFriends = async (id1, id2) => {
  const [userA, userB] = orderPair(id1, id2);
  return Friendship.exists({ userA, userB });
};
