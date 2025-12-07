import Activity from '../models/Activity.js';
import QuizResult from '../models/QuizResult.js';
import Note from '../models/Note.js';
import StudySession from '../models/StudySession.js';
import logger from '../utils/logger.js';

/**
 * Get recent activities for user
 * GET /api/activity/:userId
 */
export const getRecentActivity = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const { limit = 20 } = req.query;

    // Verify user access
    if (userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get activities from Activity collection
    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-__v')
      .lean();

    // Format activities with time ago
    const formattedActivities = activities.map((activity) => {
      const timeAgo = getTimeAgo(activity.createdAt);
      return {
        id: activity._id,
        type: activity.type,
        subject: activity.subject,
        topic: activity.topic,
        score: activity.score,
        timeAgo,
        createdAt: activity.createdAt,
        details: activity.details,
      };
    });

    logger.info(`Recent activities fetched for user ${userId}`);

    res.json({
      success: true,
      count: formattedActivities.length,
      activities: formattedActivities,
    });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch recent activities',
    });
  }
};

/**
 * Create activity record
 * Helper function to be called from other controllers
 */
export const createActivity = async (userId, type, data) => {
  try {
    const activity = new Activity({
      userId,
      type,
      subject: data.subject || null,
      topic: data.topic || null,
      score: data.score || null,
      details: data.details || {},
    });

    await activity.save();
    logger.debug(`Activity created: ${type} for user ${userId}`);
  } catch (error) {
    logger.error('Create activity error:', error);
    // Don't throw - activity creation shouldn't break main flow
  }
};

/**
 * Get streak information
 * GET /api/streak/:userId
 */
export const getStreak = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    // Verify user access
    if (userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get activities grouped by date
    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();

    // Calculate current streak
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activityDates = new Set();
    activities.forEach((activity) => {
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);
      activityDates.add(activityDate.getTime());
    });

    const sortedDates = Array.from(activityDates).sort((a, b) => b - a);

    // Calculate current streak
    let checkDate = new Date(today);
    for (const dateTime of sortedDates) {
      const date = new Date(dateTime);
      date.setHours(0, 0, 0, 0);

      if (date.getTime() === checkDate.getTime()) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date.getTime() < checkDate.getTime()) {
        break;
      }
    }

    // Calculate best streak
    let lastDate = null;
    for (const dateTime of sortedDates) {
      const date = new Date(dateTime);
      date.setHours(0, 0, 0, 0);

      if (lastDate === null) {
        tempStreak = 1;
        lastDate = date;
      } else {
        const diffDays = Math.round((lastDate - date) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 1;
        }
        lastDate = date;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);

    res.json({
      success: true,
      streak: {
        currentStreak,
        bestStreak,
      },
    });
  } catch (error) {
    logger.error('Get streak error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch streak',
    });
  }
};

/**
 * Get performance metrics
 * GET /api/performance/:userId
 */
export const getPerformance = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    // Verify user access
    if (userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get study time from study sessions
    const studyTimeResult = await StudySession.aggregate([
      { $match: { userId, isCompleted: true } },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: { $divide: ['$totalDuration', 60] } },
        },
      },
    ]);
    const studyTime = Math.round(studyTimeResult[0]?.totalMinutes || 0);

    // Get quizzes passed (score >= 70)
    const quizzesPassed = await QuizResult.countDocuments({
      userId,
      isCompleted: true,
      score: { $gte: 70 },
    });

    // Get notes reviewed (notes with updatedAt in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notesReviewed = await Note.countDocuments({
      userId,
      updatedAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      performance: {
        studyTime, // minutes
        quizzesPassed,
        notesReviewed,
      },
    });
  } catch (error) {
    logger.error('Get performance error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch performance',
    });
  }
};

/**
 * Helper function to calculate time ago
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(date).toLocaleDateString();
}


