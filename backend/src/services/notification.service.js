import Notification from '../models/Notification.js';

// Socket.io instance (will be set by server)
let socketIO = null;

/**
 * Set Socket.io instance for real-time notifications
 * @param {Object} io - Socket.io server instance
 */
export const setSocketIO = (io) => {
  socketIO = io;
};

/**
 * Notification message templates
 */
const NOTIFICATION_MESSAGES = {
  // Documents
  document_ready: 'Your notes are ready!',
  document_processed: 'Your document has been processed.',
  ai_summary_ready: 'AI summary is ready.',
  document_removed: 'Document removed.',
  document_process_failed: 'Failed to process document.',

  // Flashcards
  flashcards_created: 'Flashcards created from your notes.',
  flashcards_saved: 'Your flashcards are saved.',
  flashcards_updated: 'Flashcards updated.',
  flashcard_deleted: 'Flashcard deleted.',
  review_due: 'Review due today.',
  flashcards_added: 'New flashcards added.',

  // Quiz
  quiz_generated: 'Your AI Quiz is generated.',
  quiz_finished: 'Quiz finished.',
  quiz_submitted: 'Quiz submitted.',
  quiz_results_ready: 'Quiz results are ready.',

  // Progress
  streak_maintained: 'Study streak maintained.',
  streak_broken: 'Streak broken.',
  weekly_report_ready: 'Weekly report ready.',
  task_completed: 'Task completed.',
  pending_reviews: 'Pending reviews available.',

  // Profile
  profile_updated: 'Profile updated.',
  password_changed: 'Password changed.',
  new_device_login: 'New device login.',
  google_login_failed: 'Google login failed.',
  logged_out: 'Logged out.',

  // Security
  multiple_login_attempts: 'Multiple login attempts detected.',
  suspicious_activity: 'Suspicious activity detected.',
  email_verified: 'Email verified.',
  verification_failed: 'Verification failed.',

  // AI
  ai_study_plan_ready: 'AI Study Plan is ready.',
  ai_chat_saved: 'AI chat saved.',
  ai_analysis_error: 'AI analysis error.',
  study_recommendations: 'New study recommendations available.',
};

/**
 * Category mapping for notification types
 */
const TYPE_TO_CATEGORY = {
  document_ready: 'documents',
  document_processed: 'documents',
  ai_summary_ready: 'documents',
  document_removed: 'documents',
  document_process_failed: 'documents',

  flashcards_created: 'flashcards',
  flashcards_saved: 'flashcards',
  flashcards_updated: 'flashcards',
  flashcard_deleted: 'flashcards',
  review_due: 'flashcards',
  flashcards_added: 'flashcards',

  quiz_generated: 'quiz',
  quiz_finished: 'quiz',
  quiz_submitted: 'quiz',
  quiz_results_ready: 'quiz',

  streak_maintained: 'progress',
  streak_broken: 'progress',
  weekly_report_ready: 'progress',
  task_completed: 'progress',
  pending_reviews: 'progress',

  profile_updated: 'profile',
  password_changed: 'profile',
  new_device_login: 'profile',
  google_login_failed: 'profile',
  logged_out: 'profile',

  multiple_login_attempts: 'security',
  suspicious_activity: 'security',
  email_verified: 'security',
  verification_failed: 'security',

  ai_study_plan_ready: 'ai',
  ai_chat_saved: 'ai',
  ai_analysis_error: 'ai',
  study_recommendations: 'ai',
};

/**
 * Priority mapping for notification types
 */
const TYPE_TO_PRIORITY = {
  document_process_failed: 'high',
  google_login_failed: 'high',
  multiple_login_attempts: 'urgent',
  suspicious_activity: 'urgent',
  verification_failed: 'high',
  ai_analysis_error: 'high',
  review_due: 'medium',
  pending_reviews: 'medium',
  streak_broken: 'low',
  weekly_report_ready: 'low',
  default: 'medium',
};

/**
 * Create a notification
 * @param {Object} options
 * @param {string} options.userId - User ID
 * @param {string} options.type - Notification type
 * @param {string} options.title - Optional custom title
 * @param {string} options.message - Optional custom message
 * @param {Object} options.metadata - Optional metadata
 * @param {string} options.relatedId - Optional related resource ID
 * @param {string} options.relatedType - Optional related resource type
 * @param {string} options.priority - Optional priority (low, medium, high, urgent)
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async ({
  userId,
  type,
  title = null,
  message = null,
  metadata = {},
  relatedId = null,
  relatedType = null,
  priority = null,
}) => {
  try {
    if (!userId || !type) {
      throw new Error('UserId and type are required');
    }

    // Get default message if not provided
    const notificationMessage = message || NOTIFICATION_MESSAGES[type] || 'New notification';
    const notificationTitle = title || notificationMessage;

    // Get category from type
    const category = TYPE_TO_CATEGORY[type] || 'progress';

    // Get priority from type or use provided/default
    const notificationPriority = priority || TYPE_TO_PRIORITY[type] || TYPE_TO_PRIORITY.default;

    const notification = await Notification.create({
      userId,
      type,
      title: notificationTitle,
      message: notificationMessage,
      category,
      metadata,
      relatedId,
      relatedType,
      priority: notificationPriority,
    });

    // Emit real-time notification if Socket.io is available
    if (socketIO) {
      try {
        const { emitNotification, emitUnreadCount } = await import('../config/socket.js');
        emitNotification(socketIO, userId, notification.toObject());

        // Update unread count
        const unreadCount = await getUnreadCount(userId);
        emitUnreadCount(socketIO, userId, unreadCount);
      } catch (error) {
        console.error('Error emitting real-time notification:', error);
      }
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create multiple notifications for multiple users
 * @param {Array} notifications - Array of notification objects
 * @returns {Promise<Array>} Created notifications
 */
export const createBulkNotifications = async (notifications) => {
  try {
    const notificationDocs = notifications.map(({ userId, type, title, message, metadata, relatedId, relatedType, priority }) => {
      const notificationMessage = message || NOTIFICATION_MESSAGES[type] || 'New notification';
      const notificationTitle = title || notificationMessage;
      const category = TYPE_TO_CATEGORY[type] || 'progress';
      const notificationPriority = priority || TYPE_TO_PRIORITY[type] || TYPE_TO_PRIORITY.default;

      return {
        userId,
        type,
        title: notificationTitle,
        message: notificationMessage,
        category,
        metadata,
        relatedId,
        relatedType,
        priority: notificationPriority,
      };
    });

    const created = await Notification.insertMany(notificationDocs);
    return created;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

/**
 * Get unread count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
export const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });
    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Object>} Updated notification
 */
export const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update result
 */
export const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Object>} Deleted notification
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });
    return notification;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

export default {
  createNotification,
  createBulkNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  setSocketIO,
  NOTIFICATION_MESSAGES,
  TYPE_TO_CATEGORY,
  TYPE_TO_PRIORITY,
};

