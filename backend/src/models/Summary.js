import mongoose from 'mongoose';

const SummarySchema = new mongoose.Schema(
  {
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      required: true,
      index: true,
    },
    summaryType: {
      type: String,
      enum: ['key_points', 'structured', 'simplified', 'exam_focus'],
      required: true,
    },
    summaryLength: {
      type: String,
      enum: ['brief', 'standard', 'detailed'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    advancedOptions: {
      includeExamples: {
        type: Boolean,
        default: false,
      },
      includeDiagrams: {
        type: Boolean,
        default: false,
      },
      focusAreas: {
        type: [String],
        default: [],
      },
      customInstructions: {
        type: String,
        default: '',
      },
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Index for faster queries
SummarySchema.index({ noteId: 1, userId: 1 });
SummarySchema.index({ userId: 1, generatedAt: -1 });

const Summary = mongoose.models.Summary || mongoose.model('Summary', SummarySchema);
export default Summary;



