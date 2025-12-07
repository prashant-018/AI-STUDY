import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Alias for consistency
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, default: '' },
    wordCount: {
      type: Number,
      required: true,
      default: 0,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'advanced'],
      default: 'medium',
    },
    subject: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Auto-calculate wordCount before save
NoteSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.isModified('content') || this.isNew) {
    // Count words: split by whitespace and filter empty strings
    this.wordCount = this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  // Sync userId with user field for consistency
  if (this.user && !this.userId) {
    this.userId = this.user;
  }
  if (this.userId && !this.user) {
    this.user = this.userId;
  }
  next();
});

// Indexes for better query performance
NoteSchema.index({ userId: 1, createdAt: -1 });
NoteSchema.index({ subject: 1, difficulty: 1 });
NoteSchema.index({ title: 'text', content: 'text' });

const Note = mongoose.models.Note || mongoose.model('Note', NoteSchema);
export default Note;



