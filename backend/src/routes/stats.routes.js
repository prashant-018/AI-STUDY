import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getUserStats } from '../controllers/stats.controller.js';

const router = Router();

// Get user statistics
router.get('/', authRequired, getUserStats);

export default router;



