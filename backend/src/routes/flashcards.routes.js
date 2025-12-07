import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getFlashcards,
  getFlashcard,
  getFlashcardsStudyDashboard,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  reviewFlashcard,
  markFlashcardKnown,
  markFlashcardMastered,
  getDueCards,
  updateFlashcardSettings,
} from '../controllers/flashcards.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Get cards due for review (should be before /:id route)
router.get('/due', getDueCards);
router.get('/study-dashboard', getFlashcardsStudyDashboard);
router.put('/settings', updateFlashcardSettings);

// CRUD operations
router.get('/', getFlashcards);
router.post('/', createFlashcard);
router.get('/:id', getFlashcard);
router.put('/:id', updateFlashcard);
router.delete('/:id', deleteFlashcard);

// Review and status updates
router.post('/:id/review', reviewFlashcard);
router.post('/:id/mark-known', markFlashcardKnown);
router.post('/:id/mark-mastered', markFlashcardMastered);

export default router;



