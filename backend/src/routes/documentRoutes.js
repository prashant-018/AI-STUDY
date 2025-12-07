import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authRequired } from '../middleware/auth.js';
import {
  uploadDocument,
  getDocuments,
  getDocumentDetails,
  downloadDocument,
  viewDocument,
  shareDocument,
  deleteDocument,
  searchDocuments,
  generateFlashcards,
  generateQuestions,
  getDocumentContent,
} from '../controllers/documents.controller.js';
import { MAX_UPLOAD_BYTES } from '../utils/file.utils.js';

const router = Router();

const allowedMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
]);

const ensureUserUploadDir = (userId) => {
  const dir = path.join(process.cwd(), 'uploads', 'documents', String(userId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    if (!req.user || !req.user._id) {
      const err = new Error('Authentication required');
      err.status = 401;
      return cb(err);
    }
    try {
      const userDir = ensureUserUploadDir(req.user._id);
      return cb(null, userDir);
    } catch (error) {
      return cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/\s+/g, '-');
    cb(null, `${timestamp}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (allowedMime.has(file.mimetype)) {
      return cb(null, true);
    }
    const err = new Error('Unsupported file type');
    err.status = 400;
    return cb(err);
  },
});

const uploadSingleFile = upload.single('file');

router.post('/upload', authRequired, (req, res, next) => {
  uploadSingleFile(req, res, (err) => {
    if (err) {
      const status = err.status || 400;
      const message = err.message || 'Upload failed';
      console.error('Upload middleware error:', message);
      return res.status(status).json({ success: false, error: message });
    }
    if (!req.file) {
      console.error('Upload middleware error: file is required');
      return res.status(400).json({ success: false, error: 'file is required' });
    }
    return uploadDocument(req, res);
  });
});
router.get('/', authRequired, getDocuments);
router.get('/search', authRequired, searchDocuments);
router.get('/:id', authRequired, getDocumentDetails);
router.get('/:id/view', authRequired, viewDocument);
router.get('/:id/download', authRequired, downloadDocument);
router.get('/:id/share', authRequired, shareDocument);
router.post('/:id/share', authRequired, shareDocument);
router.get('/:id/content', authRequired, getDocumentContent);
router.post('/:id/generate-flashcards', authRequired, generateFlashcards);
router.post('/:id/generate-questions', authRequired, generateQuestions);
router.delete('/:id', authRequired, deleteDocument);

export default router;

