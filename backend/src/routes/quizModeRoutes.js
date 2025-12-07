import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  startQuiz,
  submitAnswer,
  completeQuiz,
  getQuizStatus,
} from '../controllers/quizModeController.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

router.post('/start', startQuiz);
router.get('/:quizId', getQuizStatus);
router.post('/:quizId/answer', submitAnswer);
router.post('/:quizId/complete', completeQuiz);

export default router;


