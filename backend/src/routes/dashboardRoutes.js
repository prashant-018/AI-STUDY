import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getDashboardMetrics,
  getQuickActions,
  getRecentActivity,
  getCurrentStreak,
  getUpcomingSessions,
  getWeeklyPerformance,
} from '../controllers/dashboardController.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Specific routes first (before parameterized routes)
router.get('/quick-actions', getQuickActions);
router.get('/recent-activity', getRecentActivity);
router.get('/streak', getCurrentStreak);
router.get('/upcoming-sessions', getUpcomingSessions);
router.get('/weekly-performance', getWeeklyPerformance);
// Metrics route - can use userId param or default to req.user._id
router.get('/metrics', getDashboardMetrics);
router.get('/:userId', getDashboardMetrics);

export default router;


