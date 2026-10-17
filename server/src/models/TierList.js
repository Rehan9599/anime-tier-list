import mongoose from 'mongoose';

const animeItemSchema = new mongoose.Schema(
  {
    animeId: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'animeId must be an integer',
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    genres: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 80,
        },
      ],
      default: [],
      validate: {
        validator: (genres) => genres.length <= 30,
        message: 'An anime item cannot have more than 30 genres',
      },
    },
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
    score: {
      type: Number,
      default: null,
      min: 0,
      max: 10,
    },
  },
  { _id: false }
);
const MAX_ITEMS_PER_TIER = 60;
// category is an enum on purpose -- adding "movie" or "game" later is a
// one-line change here, everything else in the app is category-agnostic.
const tierListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: ['anime'], default: 'anime', required: true },
    tiers: {
      S: {
        type: [animeItemSchema],
        default: [],
        validate: {
          validator: (items) => items.length <= MAX_ITEMS_PER_TIER,
          message: `A tier cannot contain more than ${MAX_ITEMS_PER_TIER} items`,
        },
      },
      A: {
        type: [animeItemSchema],
        default: [],
        validate: {
          validator: (items) => items.length <= MAX_ITEMS_PER_TIER,
          message: `A tier cannot contain more than ${MAX_ITEMS_PER_TIER} items`,
        },
      },
      B: {
        type: [animeItemSchema],
        default: [],
        validate: {
          validator: (items) => items.length <= MAX_ITEMS_PER_TIER,
          message: `A tier cannot contain more than ${MAX_ITEMS_PER_TIER} items`,
        },
      },
      C: {
        type: [animeItemSchema],
        default: [],
        validate: {
          validator: (items) => items.length <= MAX_ITEMS_PER_TIER,
          message: `A tier cannot contain more than ${MAX_ITEMS_PER_TIER} items`,
        },
      },
    },
  },
  { timestamps: true }
);

tierListSchema.index({ userId: 1, category: 1 }, { unique: true });

export default mongoose.model('TierList', tierListSchema);
