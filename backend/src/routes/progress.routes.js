import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getUserProgress, getStudyStats } from '../controllers/progress.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

router.get('/', getUserProgress);
router.get('/stats', getStudyStats);

export default router;



