import UserProgress from '../models/UserProgress.js';
import Flashcard from '../models/Flashcard.js';
import StudySession from '../models/StudySession.js';
import { calculateMasteryPercentage } from '../utils/spacedRepetition.js';

/**
 * Get user progress overview
 * GET /api/progress
 */
export const getUserProgress = async (req, res) => {
  try {
    const userId = req.user._id;

    let userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      // Create initial progress record
      userProgress = new UserProgress({ userId });
      await userProgress.save();
    }

    // Get recent study sessions
    const recentSessions = await StudySession.find({ userId, isCompleted: true })
      .sort({ endTime: -1 })
      .limit(10)
      .select('mode subject totalCards cardsReviewed cardsCorrect completionPercentage endTime')
      .lean();

    // Get subject breakdown
    const subjectStats = await Flashcard.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$subject',
          total: { $sum: 1 },
          known: {
            $sum: { $cond: [{ $eq: ['$status', 'known'] }, 1, 0] },
          },
          mastered: {
            $sum: { $cond: [{ $eq: ['$status', 'mastered'] }, 1, 0] },
          },
        },
      },
    ]);

    const subjectBreakdown = {};
    subjectStats.forEach((stat) => {
      const masteryPercentage =
        stat.total > 0
          ? Math.round(((stat.known + stat.mastered) / stat.total) * 100)
          : 0;

      subjectBreakdown[stat._id] = {
        total: stat.total,
        known: stat.known,
        mastered: stat.mastered,
        masteryPercentage,
      };
    });

    // Get status breakdown
    const statusBreakdown = await Flashcard.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = {
      new: 0,
      learning: 0,
      review: 0,
      known: 0,
      mastered: 0,
    };

    statusBreakdown.forEach((stat) => {
      if (statusMap.hasOwnProperty(stat._id)) {
        statusMap[stat._id] = stat.count;
      }
    });

    // Get cards due for review
    const dueCardsCount = await Flashcard.countDocuments({
      userId,
      nextReviewDate: { $lte: new Date() },
    });

    res.json({
      success: true,
      progress: {
        totalFlashcards: userProgress.totalFlashcards,
        knownCards: userProgress.knownCards,
        masteredCards: userProgress.masteredCards,
        reviewCards: userProgress.reviewCards,
        masteryProgress: userProgress.masteryProgress,
        totalStudySessions: userProgress.totalStudySessions,
        totalReviews: userProgress.totalReviews,
        totalStudyTime: userProgress.totalStudyTime,
        currentStreak: userProgress.currentStreak,
        longestStreak: userProgress.longestStreak,
        lastStudyDate: userProgress.lastStudyDate,
        dueCardsCount,
        statusBreakdown: statusMap,
        subjectBreakdown,
        recentSessions,
      },
    });
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user progress',
    });
  }
};

/**
 * Get study statistics
 * GET /api/progress/stats
 */
export const getStudyStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get sessions in date range
    const sessions = await StudySession.find({
      userId,
      isCompleted: true,
      endTime: { $gte: startDate },
    }).sort({ endTime: -1 });

    // Calculate statistics
    const totalSessions = sessions.length;
    const totalCardsReviewed = sessions.reduce((sum, s) => sum + s.cardsReviewed, 0);
    const totalCardsCorrect = sessions.reduce((sum, s) => sum + s.cardsCorrect, 0);
    const totalStudyTime = sessions.reduce((sum, s) => sum + s.totalDuration, 0);

    const accuracyRate =
      totalCardsReviewed > 0
        ? Math.round((totalCardsCorrect / totalCardsReviewed) * 100)
        : 0;

    // Daily activity
    const dailyActivity = {};
    sessions.forEach((session) => {
      const date = new Date(session.endTime).toISOString().split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = {
          sessions: 0,
          cardsReviewed: 0,
          studyTime: 0,
        };
      }
      dailyActivity[date].sessions += 1;
      dailyActivity[date].cardsReviewed += session.cardsReviewed;
      dailyActivity[date].studyTime += session.totalDuration;
    });

    // Mode breakdown
    const modeBreakdown = {
      standard: 0,
      quick_review: 0,
      exam_mode: 0,
    };

    sessions.forEach((session) => {
      if (modeBreakdown.hasOwnProperty(session.mode)) {
        modeBreakdown[session.mode] += 1;
      }
    });

    res.json({
      success: true,
      stats: {
        period: `${days} days`,
        totalSessions,
        totalCardsReviewed,
        totalCardsCorrect,
        accuracyRate,
        totalStudyTime: Math.round(totalStudyTime / 60), // minutes
        averageSessionTime: Math.round(totalStudyTime / totalSessions / 60), // minutes
        dailyActivity,
        modeBreakdown,
      },
    });
  } catch (error) {
    console.error('Get study stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch study statistics',
    });
  }
};



