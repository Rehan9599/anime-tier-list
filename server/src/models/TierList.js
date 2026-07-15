import mongoose from 'mongoose';

const animeItemSchema = new mongoose.Schema(
  {
    animeId: { type: Number, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
  },
  { _id: false }
);

// category is an enum on purpose -- adding "movie" or "game" later is a
// one-line change here, everything else in the app is category-agnostic.
const tierListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: ['anime'], default: 'anime', required: true },
    tiers: {
      S: { type: [animeItemSchema], default: [] },
      A: { type: [animeItemSchema], default: [] },
      B: { type: [animeItemSchema], default: [] },
      C: { type: [animeItemSchema], default: [] },
    },
  },
  { timestamps: true }
);

tierListSchema.index({ userId: 1, category: 1 }, { unique: true });

export default mongoose.model('TierList', tierListSchema);
