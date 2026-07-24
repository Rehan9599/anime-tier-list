import mongoose from 'mongoose';

const animeItemSchema = new mongoose.Schema(
  {
    animeId: { type: Number, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
    genres: { type: [String], default: [] },
    score: { type: Number, default: null },
  },
  { _id: false }
);

const communitySessionSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, unique: true },
    category: { type: String, enum: ['anime'], default: 'anime' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    tiers: {
      S: { type: [animeItemSchema], default: [] },
      A: { type: [animeItemSchema], default: [] },
      B: { type: [animeItemSchema], default: [] },
      C: { type: [animeItemSchema], default: [] },
    },
  },
  { timestamps: true }
);

export default mongoose.model('CommunitySession', communitySessionSchema);
