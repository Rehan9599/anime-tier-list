import mongoose from 'mongoose';

const watchedStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    animeId: { type: Number, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
    watched: { type: Boolean, required: true },
    // Used to let the tier board filter combine a "Watched" tag with genre
    // tags (e.g. "Watched" + "Action") -- same pattern TierList already
    // uses for its stored tier items.
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

watchedStatusSchema.index({ userId: 1, animeId: 1 }, { unique: true });

export default mongoose.model('WatchedStatus', watchedStatusSchema);