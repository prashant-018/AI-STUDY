import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getRecentActivity,
  getStreak,
  getPerformance,
} from '../controllers/activityController.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

router.get('/', getRecentActivity);
router.get('/streak', getStreak);
router.get('/performance', getPerformance);

// Admin/explicit user access
router.get('/user/:userId', getRecentActivity);
router.get('/streak/:userId', getStreak);
router.get('/performance/:userId', getPerformance);

export default router;


