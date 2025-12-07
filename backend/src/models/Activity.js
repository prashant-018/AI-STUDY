import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['quiz', 'note', 'flashcard', 'summary', 'study_session'],
      required: true,
    },
    subject: {
      type: String,
      default: null,
    },
    topic: {
      type: String,
      default: null,
    },
    score: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

// Indexes for efficient queries
ActivitySchema.index({ userId: 1, createdAt: -1 });
ActivitySchema.index({ userId: 1, type: 1 });

const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
export default Activity;


