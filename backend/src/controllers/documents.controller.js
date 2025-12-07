import fs from 'fs';
import path from 'path';
import * as pdfParse from 'pdf-parse';
import Document from '../models/Document.js';
import { queueFlashcardGeneration, generateFlashcardsForDocument } from '../services/flashcardGenerator.service.js';
import { generateQuestionsForDocument } from '../services/quizGenerator.service.js';
import { createNotification } from '../services/notification.service.js';
import { loadDocumentContent } from '../utils/documentContent.js';
import {
  MAX_UPLOAD_BYTES,
  STORAGE_LIMIT_BYTES,
  categorizeMime,
  formatFileSize,
  formatRelativeTime,
  getFileExtension,
  normalizeTags,
} from '../utils/file.utils.js';

const buildDocumentResponse = (doc) => {
  const tags = doc.tags || [];
  const formattedTags = [
    ...(doc.category ? [doc.category] : []),
    ...tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)),
  ];
  return {
    _id: doc._id,
    title: doc.title,
    category: doc.category,
    description: doc.description,
    tags: formattedTags,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: formatFileSize(doc.fileSize),
    fileSizeBytes: doc.fileSize,
    pageCount: doc.pageCount || 0,
    uploadedAt: doc.uploadedAt,
    uploadedAtLabel: formatRelativeTime(doc.uploadedAt),
    lastOpenedAt: doc.lastOpenedAt,
    lastOpenedLabel: formatRelativeTime(doc.lastOpenedAt),
    filePath: doc.filePath,
    autoFlashcardsStatus: doc.autoFlashcardsStatus,
    autoFlashcardsCount: doc.autoFlashcardsCount,
    autoFlashcardsLastGeneratedAt: doc.autoFlashcardsLastGeneratedAt,
    autoFlashcardsError: doc.autoFlashcardsError,
  };
};

export const uploadDocument = async (req, res) => {
  try {
    const { title, category, description } = req.body || {};
    if (!req.user || !req.user._id) {
      console.error('Upload error: missing authenticated user on request');
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!req.file) {
      console.error('Upload error: file is required');
      return res.status(400).json({ success: false, error: 'file is required' });
    }
    if (!title) {
      console.error('Upload error: title is required');
      return res.status(400).json({ success: false, error: 'title is required' });
    }
    if (req.file.size > MAX_UPLOAD_BYTES) {
      console.error('Upload error: file exceeds size limit');
      return res.status(400).json({ success: false, error: 'File exceeds 50MB limit' });
    }

    console.log('📁 File received:', {
      originalName: req.file.originalname,
      storedAs: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    const tags = normalizeTags(req.body.tags);
    const extension = getFileExtension(req.file.originalname);
    const mime = req.file.mimetype;
    const absolutePath = req.file.path;
    // Store path relative to uploads directory for proper static serving
    // File is stored at: uploads/documents/{userId}/filename
    // So relative path should be: documents/{userId}/filename
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const relativePath = path.relative(uploadsDir, absolutePath).replace(/\\/g, '/');

    let pageCount = 0;
    if (mime === 'application/pdf') {
      try {
        const buffer = fs.readFileSync(absolutePath);
        const parsed = await pdfParse(buffer);
        pageCount = parsed?.numpages || 0;
      } catch (err) {
        console.warn('PDF parse failed:', err?.message || err);
      }
    }

    const document = new Document({
      userId: req.user._id,
      title,
      category,
      description,
      tags,
      fileName: req.file.originalname,
      filePath: relativePath,
      fileSize: req.file.size,
      // Store MIME type for proper Content-Type headers later
      fileType: mime || extension,
      pageCount,
      uploadedAt: new Date(),
    });

    console.log('📝 Document instance created:', {
      id: document._id,
      title: document.title,
      category: document.category,
    });

    await document.save();

    console.log('✅ Document saved to DB:', {
      id: document._id.toString(),
      filePath: document.filePath,
      absolutePath: absolutePath,
    });

    // Verify file exists after save
    if (!fs.existsSync(absolutePath)) {
      console.error('⚠️ WARNING: File not found after save:', absolutePath);
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      document: buildDocumentResponse(document),
    });

    // Create notification for document upload
    createNotification({
      userId: req.user._id,
      type: 'document_ready',
      metadata: { documentId: document._id.toString(), title: document.title },
      relatedId: document._id,
      relatedType: 'document',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    queueFlashcardGeneration(document._id, { maxCards: 6 }).catch((err) => {
      console.error('Failed to queue flashcard generation:', err?.message || err);
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to upload document' });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const { filter = 'all', search } = req.query;
    const query = { userId: req.user._id };
    let sort = { uploadedAt: -1 };

    if (filter === 'recent') {
      sort = { lastOpenedAt: -1, uploadedAt: -1 };
    } else if (filter && filter !== 'all') {
      query.category = filter;
    }

    if (search) {
      const regex = new RegExp(String(search), 'i');
      query.$or = [{ title: regex }, { description: regex }, { category: regex }, { tags: regex }];
    }

    const documents = await Document.find(query).sort(sort);

    const formattedDocs = documents.map(buildDocumentResponse);
    const totalBytes = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const uniqueCategories = new Set(documents.map((doc) => doc.category).filter(Boolean));

    res.json({
      success: true,
      documents: formattedDocs,
      stats: {
        totalNotes: documents.length,
        storageUsed: formatFileSize(totalBytes),
        categories: uniqueCategories.size,
      },
    });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch documents' });
  }
};

export const getDocumentDetails = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({
      success: true,
      document: buildDocumentResponse(document),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch document' });
  }
};

const getMimeType = (fileType, fileName) => {
  // If fileType is already a MIME type, use it
  if (fileType && fileType.includes('/')) {
    return fileType;
  }

  // Map common extensions to MIME types
  const ext = path.extname(fileName || '').toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.heic': 'image/heic',
  };

  return mimeMap[ext] || 'application/octet-stream';
};

const handleFileSend = async (req, res, download = false) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Reconstruct absolute path from stored relative path
    // Stored path format: documents/{userId}/filename
    const absolutePath = path.join(process.cwd(), 'uploads', document.filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error('File not found at path:', absolutePath);
      console.error('Stored filePath:', document.filePath);
      return res.status(404).json({ success: false, error: 'File not found on server' });
    }

    // Update last opened timestamp
    document.lastOpenedAt = new Date();
    await document.save();

    // Get proper MIME type
    const mimeType = getMimeType(document.fileType, document.fileName);

    if (download) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName)}"`);
      return res.sendFile(absolutePath);
    }

    // For viewing, set proper Content-Type and allow inline display
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('handleFileSend error:', error);
    throw error;
  }
};

export const downloadDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Reconstruct absolute path from stored relative path
    const absolutePath = path.join(process.cwd(), 'uploads', document.filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error('Download: File not found at path:', absolutePath);
      console.error('Stored filePath:', document.filePath);
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    // Update last opened timestamp
    document.lastOpenedAt = new Date();
    await document.save();

    // Get proper MIME type
    const mimeType = getMimeType(document.fileType, document.fileName);

    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName)}"`);
    res.setHeader('Content-Length', document.fileSize || fs.statSync(absolutePath).size);

    // Stream the file
    const fileStream = fs.createReadStream(absolutePath);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to stream file' });
      }
    });

    fileStream.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to download document' });
    }
  }
};

export const viewDocument = async (req, res) => {
  try {
    await handleFileSend(req, res, false);
  } catch (err) {
    console.error('View error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to open document' });
    }
  }
};

export const shareDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).select('_id filePath');
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({
      success: true,
      filePath: document.filePath,
      documentId: document._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate share link' });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    if (document.filePath) {
      const absolutePath = path.join(process.cwd(), document.filePath);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
        } catch (err) {
          console.warn('Failed to delete file:', err?.message || err);
        }
      }
    }

    // Create notification for document removal
    createNotification({
      userId: req.user._id,
      type: 'document_removed',
      metadata: { documentId: document._id.toString(), title: document.title },
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete document' });
  }
};

export const searchDocuments = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'q query param is required' });
    }
    const regex = new RegExp(String(q), 'i');
    const documents = await Document.find({
      userId: req.user._id,
      $or: [{ title: regex }, { description: regex }, { category: regex }, { tags: regex }],
    }).sort({ uploadedAt: -1 });
    res.json({
      success: true,
      documents: documents.map(buildDocumentResponse),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Search failed' });
  }
};

export const getStorageOverview = async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user._id });
    const totals = { documents: 0, images: 0, other: 0 };
    let totalBytes = 0;
    documents.forEach((doc) => {
      const bytes = doc.fileSize || 0;
      totalBytes += bytes;
      const bucket = categorizeMime(doc.fileType) || 'other';
      totals[bucket] += bytes;
    });
    res.json({
      success: true,
      storage: {
        totalUsed: formatFileSize(totalBytes),
        totalLimit: formatFileSize(STORAGE_LIMIT_BYTES, 1),
        documents: formatFileSize(totals.documents),
        images: formatFileSize(totals.images),
        other: formatFileSize(totals.other),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to calculate storage' });
  }
};

/**
 * Get extracted text/content from a document
 * GET /api/documents/:id/content
 */
export const getDocumentContent = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Check if document supports content extraction
    const isImage = document.fileType?.startsWith('image/');
    const isPDF = document.fileType === 'application/pdf';
    const isText = document.fileType === 'text/plain' || document.fileType?.startsWith('text/');

    if (!isImage && !isPDF && !isText) {
      return res.status(400).json({
        success: false,
        error: 'Content extraction is only supported for images, PDFs, and text files',
      });
    }

    // Extract content from document
    const content = await loadDocumentContent(document);

    if (!content || content.trim().length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No text content found in this document. The image may not contain readable text.',
      });
    }

    res.json({
      success: true,
      content: content.trim(),
      documentTitle: document.title,
      fileType: document.fileType,
      extractedAt: new Date(),
    });
  } catch (err) {
    console.error('Get document content error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to extract content from document',
    });
  }
};

/**
 * Generate flashcards from a document/image
 * POST /api/documents/:id/generate-flashcards
 */
export const generateFlashcards = async (req, res) => {
  try {
    const { maxCards = 6 } = req.body || {};
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Check if document is an image
    const isImage = document.fileType?.startsWith('image/');
    if (!isImage && document.fileType !== 'application/pdf' && document.fileType !== 'text/plain') {
      return res.status(400).json({
        success: false,
        error: 'Flashcard generation is only supported for images, PDFs, and text files',
      });
    }

    // Generate flashcards
    const result = await generateFlashcardsForDocument(document._id, { maxCards });
    const createdCount = result.createdFlashcards?.length || 0;
    const duplicateCount = result.duplicateCount || 0;

    const baseResponse = {
      success: true,
      flashcardsCount: createdCount,
      duplicatesSkipped: duplicateCount,
      totalGenerated: result.totalGenerated || createdCount,
      document: buildDocumentResponse(document),
    };

    if (createdCount > 0) {
      baseResponse.message = `Successfully generated ${createdCount} flashcards`;
    } else if (duplicateCount > 0) {
      baseResponse.message = 'No new flashcards were created because identical flashcards already exist for this document.';
      baseResponse.info = 'Try editing the document or deleting existing flashcards if you want to regenerate them.';
    } else {
      baseResponse.message = 'No flashcards were created. Try adding more detailed text to the document and try again.';
    }

    res.json(baseResponse);
  } catch (err) {
    console.error('Generate flashcards error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate flashcards',
    });
  }
};

/**
 * Generate quiz questions from document
 * POST /api/documents/:id/generate-questions
 */
export const generateQuestions = async (req, res) => {
  try {
    const { maxQuestions = 6 } = req.body || {};
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Check if document is an image, PDF, or text file
    const isImage = document.fileType?.startsWith('image/');
    if (!isImage && document.fileType !== 'application/pdf' && document.fileType !== 'text/plain') {
      return res.status(400).json({
        success: false,
        error: 'Quiz question generation is only supported for images, PDFs, and text files',
      });
    }

    // Generate questions
    const result = await generateQuestionsForDocument(document._id, { maxQuestions });
    const createdCount = result.createdQuestions?.length || 0;
    const duplicateCount = result.duplicateCount || 0;

    const baseResponse = {
      success: true,
      questionsCount: createdCount,
      duplicatesSkipped: duplicateCount,
      totalGenerated: result.totalGenerated || createdCount,
      questions: result.createdQuestions?.map(q => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject,
        category: q.category,
        difficulty: q.difficulty,
        points: q.points,
        timeLimit: q.timeLimit,
      })) || [],
      document: buildDocumentResponse(document),
    };

    if (createdCount > 0) {
      baseResponse.message = `Successfully generated ${createdCount} quiz questions`;
    } else if (duplicateCount > 0) {
      baseResponse.message = 'No new questions were created because identical questions already exist for this document.';
      baseResponse.info = 'Try editing the document or deleting existing questions if you want to regenerate them.';
    } else {
      baseResponse.message = 'No questions were created. Try adding more detailed text to the document and try again.';
    }

    res.json(baseResponse);
  } catch (err) {
    console.error('Generate questions error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate quiz questions',
    });
  }
};


