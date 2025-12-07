import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getRandomQuestions,
} from '../controllers/questionController.js';

const router = Router();

// Get random questions (public, but can be protected)
router.get('/random', getRandomQuestions);

// All other routes require authentication
router.use(authRequired);

router.get('/', getQuestions);
router.post('/', createQuestion);
router.get('/:id', getQuestion);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;


