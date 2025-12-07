import mongoose from 'mongoose';

const UserProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Overall Stats
    totalFlashcards: {
      type: Number,
      default: 0,
    },
    knownCards: {
      type: Number,
      default: 0,
    },
    masteredCards: {
      type: Number,
      default: 0,
    },
    reviewCards: {
      type: Number,
      default: 0,
    },

    // Study Stats
    totalReviews: {
      type: Number,
      default: 0,
    },
    totalStudySessions: {
      type: Number,
      default: 0,
    },
    totalStudyTime: {
      type: Number,
      default: 0, // minutes
    },
    currentStreak: {
      type: Number,
      default: 0, // consecutive days
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastStudyDate: {
      type: Date,
      default: null,
    },

    // Mastery Progress (0-100%)
    masteryProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Subject-wise breakdown
    subjectProgress: {
      type: Map,
      of: {
        total: { type: Number, default: 0 },
        known: { type: Number, default: 0 },
        mastered: { type: Number, default: 0 },
        masteryPercentage: { type: Number, default: 0 },
      },
      default: new Map(),
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Update timestamp before save
UserProgressSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const UserProgress = mongoose.models.UserProgress || mongoose.model('UserProgress', UserProgressSchema);
export default UserProgress;



