import mongoose from 'mongoose';

const StudySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ['standard', 'quick_review', 'exam_mode'],
      required: true,
    },
    subject: {
      type: String,
      default: null,
    },

    // Session Stats
    totalCards: {
      type: Number,
      default: 0,
    },
    cardsReviewed: {
      type: Number,
      default: 0,
    },
    cardsCorrect: {
      type: Number,
      default: 0,
    },
    cardsIncorrect: {
      type: Number,
      default: 0,
    },
    cardsMarkedKnown: {
      type: Number,
      default: 0,
    },
    cardsMastered: {
      type: Number,
      default: 0,
    },

    // Time Tracking
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    totalDuration: {
      type: Number,
      default: 0, // seconds
    },
    averageTimePerCard: {
      type: Number,
      default: 0, // seconds
    },

    // Settings Used
    settings: {
      autoFlip: {
        type: Boolean,
        default: false,
      },
      showHints: {
        type: Boolean,
        default: true,
      },
    },

    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { versionKey: false }
);

// Indexes
StudySessionSchema.index({ userId: 1, startTime: -1 });
StudySessionSchema.index({ userId: 1, isCompleted: 1 });

const StudySession = mongoose.models.StudySession || mongoose.model('StudySession', StudySessionSchema);
export default StudySession;



