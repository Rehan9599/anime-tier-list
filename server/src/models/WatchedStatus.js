import mongoose from 'mongoose';

const watchedStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    animeId: { type: Number, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
    watched: { type: Boolean, required: true },
  },
  { timestamps: true }
);

watchedStatusSchema.index({ userId: 1, animeId: 1 }, { unique: true });

export default mongoose.model('WatchedStatus', watchedStatusSchema);
