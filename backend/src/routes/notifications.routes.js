import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getNotifications,
  getUnreadCountController,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationController,
  deleteAllNotifications,
  getNotificationStats,
} from '../controllers/notifications.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Get all notifications
router.get('/', getNotifications);

// Get unread count
router.get('/unread-count', getUnreadCountController);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Mark notification as read
router.patch('/:id/read', markNotificationAsRead);

// Mark all notifications as read
router.patch('/read-all', markAllNotificationsAsRead);

// Delete notification
router.delete('/:id', deleteNotificationController);

// Delete all notifications
router.delete('/', deleteAllNotifications);

export default router;


