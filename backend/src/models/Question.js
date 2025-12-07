import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v.length >= 2 && v.length <= 6;
        },
        message: 'Options must have between 2 and 6 items',
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0 && v < this.options.length;
        },
        message: 'Correct answer index must be within options range',
      },
    },
    explanation: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    tags: {
      type: [String],
      default: [],
    },
    points: {
      type: Number,
      default: 10,
      min: 1,
      max: 100,
    },
    timeLimit: {
      type: Number,
      default: 60, // seconds
      min: 10,
      max: 300,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for system questions, userId for user-created
    },
    isActive: {
      type: Boolean,
      default: true,
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
QuestionSchema.index({ subject: 1, category: 1 });
QuestionSchema.index({ difficulty: 1 });
QuestionSchema.index({ isActive: 1 });
QuestionSchema.index({ question: 'text', explanation: 'text' });

// Update timestamp before save
QuestionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
export default Question;



