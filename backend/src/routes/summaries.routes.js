import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  generateSummaryForNote,
  generateSummaryForDocument,
  generateSummaryFromText,
  getSummariesByNote,
  getSummaryById,
  deleteSummary,
} from '../controllers/summaries.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Generate AI summary
router.post('/generate', generateSummaryForNote);
// Generate AI summary for document (supports images and PDFs)
router.post('/generate-document', generateSummaryForDocument);
// Generate AI summary from text content directly (for OCR-extracted text)
router.post('/generate-from-text', generateSummaryFromText);

// Get all summaries for a specific note
router.get('/note/:noteId', getSummariesByNote);

// Get single summary by ID
router.get('/:id', getSummaryById);

// Delete summary
router.delete('/:id', deleteSummary);

export default router;



