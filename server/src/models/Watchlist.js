import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    animeId: { type: Number, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
    genres: { type: [String], default: [] },
  },
  { timestamps: true }
);

// One entry per (user, anime) -- adding something already on the list is
// just a no-op upsert, not an error.
watchlistSchema.index({ userId: 1, animeId: 1 }, { unique: true });

export default mongoose.model('Watchlist', watchlistSchema);