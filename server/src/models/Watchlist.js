import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    animeId: { type: Number, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
    genres: { type: [String], default: [] },
    year: {
      type: Number,
      min: 1980,
      max: () => new Date().getFullYear(),
      default: null,
    },
    season: {
      type: String,
      enum: ['WINTER', 'SPRING', 'SUMMER', 'FALL', null],
      default: null,
    },
    format: {
      type: String,
      enum: ['TV', 'MOVIE', 'TV_SHORT', 'SPECIAL', 'OVA', 'ONA', 'MUSIC', null],
      default: null,
    },
  },
  { timestamps: true }
);

// One entry per (user, anime) -- adding something already on the list is
// just a no-op upsert, not an error.
watchlistSchema.index({ userId: 1, animeId: 1 }, { unique: true });

export default mongoose.model('Watchlist', watchlistSchema);