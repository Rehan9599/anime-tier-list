import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    // orderPair(userA, userB).join('_') -- same pair-ordering used for
    // Friendship, so both directions always resolve to the same room/id.
    conversationId: { type: String, required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
