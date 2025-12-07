import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  startStudySession,
  updateSessionProgress,
  completeStudySession,
  getStudySession,
  getStudySessions,
} from '../controllers/studySessions.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

router.post('/start', startStudySession);
router.get('/', getStudySessions);
router.get('/:id', getStudySession);
router.post('/:id/progress', updateSessionProgress);
router.post('/:id/complete', completeStudySession);

export default router;



