import mongoose from 'mongoose';

const FlashcardSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
    },
    hint: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      required: true, // Biology, Physics, Chemistry, etc.
    },
    category: {
      type: String,
      default: 'General',
    },
    tags: {
      type: [String],
      default: [],
    },
    examples: {
      type: [String],
      default: [],
      description: 'Optional sample answers, mnemonics, or hints for the card',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'advanced'],
      default: 'medium',
    },

    // Spaced Repetition Fields
    status: {
      type: String,
      enum: ['new', 'learning', 'review', 'known', 'mastered'],
      default: 'new',
    },
    easeFactor: {
      type: Number,
      default: 2.5, // SM-2 algorithm starting ease
    },
    interval: {
      type: Number,
      default: 0, // Days until next review
    },
    repetitions: {
      type: Number,
      default: 0, // Number of successful reviews
    },
    nextReviewDate: {
      type: Date,
      default: Date.now,
    },
    lastReviewDate: {
      type: Date,
      default: null,
    },

    // Progress Tracking
    reviewCount: {
      type: Number,
      default: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    incorrectCount: {
      type: Number,
      default: 0,
    },
    masteryLevel: {
      type: Number,
      default: 0, // 0-100%
      min: 0,
      max: 100,
    },
    averageResponseTime: {
      type: Number,
      default: 0, // milliseconds
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['manual', 'document', 'note'],
      default: 'manual',
    },
    sourceDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
      index: true,
    },
    sourceTitle: {
      type: String,
      default: null,
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Indexes for efficient queries
FlashcardSchema.index({ userId: 1, status: 1 });
FlashcardSchema.index({ userId: 1, nextReviewDate: 1 });
FlashcardSchema.index({ userId: 1, subject: 1 });
FlashcardSchema.index({ userId: 1, difficulty: 1 });
FlashcardSchema.index({ question: 'text', answer: 'text' });

// Update timestamp before save
FlashcardSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Flashcard = mongoose.models.Flashcard || mongoose.model('Flashcard', FlashcardSchema);
export default Flashcard;



