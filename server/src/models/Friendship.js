import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// userA/userB are always stored in a consistent order (see orderPair in
// friends.controller.js) so (A,B) and (B,A) can't both get created as
// separate documents -- the unique index only works if the pair is
// normalized before insertion.
friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });

export default mongoose.model('Friendship', friendshipSchema);
