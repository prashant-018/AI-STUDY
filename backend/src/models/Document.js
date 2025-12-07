import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    tags: { type: [String], default: [] },
    fileName: { type: String },
    filePath: { type: String },
    fileSize: { type: Number },
    fileType: { type: String },
    pageCount: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    lastOpenedAt: { type: Date, default: null },
    autoFlashcardsStatus: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    autoFlashcardsCount: { type: Number, default: 0 },
    autoFlashcardsLastGeneratedAt: { type: Date, default: null },
    autoFlashcardsError: { type: String, default: null },
  },
  { versionKey: false }
);

DocumentSchema.index({ title: 'text', description: 'text', category: 'text', tags: 'text' });

const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
export default Document;



