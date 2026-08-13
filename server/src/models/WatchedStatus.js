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
  },
  { timestamps: true }
);

watchedStatusSchema.index({ userId: 1, animeId: 1 }, { unique: true });

export default mongoose.model('WatchedStatus', watchedStatusSchema);