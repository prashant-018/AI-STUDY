import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  listNotes,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  getNotesStats,
  bulkDeleteNotes,
  createNotesFromQuiz,
} from '../controllers/notes.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Statistics route (must be before /:id route)
router.get('/stats', getNotesStats);

// Bulk operations route (must be before /:id route)
router.delete('/bulk', bulkDeleteNotes);

// Create notes from quiz (must be before /:id route)
router.post('/from-quiz', createNotesFromQuiz);

// Standard CRUD routes
router.get('/', listNotes);
router.post('/', createNote);
router.get('/:id', getNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

export default router;



