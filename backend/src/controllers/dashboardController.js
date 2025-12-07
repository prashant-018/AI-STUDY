import Note from '../models/Note.js';
import QuizResult from '../models/QuizResult.js';
import StudySession from '../models/StudySession.js';
import Flashcard from '../models/Flashcard.js';
import Activity from '../models/Activity.js';
import Document from '../models/Document.js';
import logger from '../utils/logger.js';

/**
 * Get dashboard metrics for user with week-over-week comparison
 * GET /api/dashboard/:userId
 */
export const getDashboardMetrics = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    // Verify user access (users can only see their own dashboard, admins can see any)
    if (userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Calculate date ranges for current week and last week
    const now = new Date();
    const currentWeekStart = new Date(now);
    const dayOfWeek = currentWeekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setMinutes(0, 0, 0);
    currentWeekStart.setSeconds(0, 0);

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(currentWeekStart);

    // Parallel queries for better performance
    const [
      totalNotes,
      notesLastWeek,
      quizzesCompleted,
      quizzesLastWeek,
      avgScoreResult,
      avgScoreLastWeekResult,
      studyHoursResult,
      studyHoursLastWeekResult,
    ] = await Promise.all([
      // Current week: Total notes
      Note.countDocuments({ userId }),

      // Last week: Notes created
      Note.countDocuments({
        userId,
        createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd },
      }),

      // Current week: Quizzes completed
      QuizResult.countDocuments({
        userId,
        isCompleted: true,
      }),

      // Last week: Quizzes completed
      QuizResult.countDocuments({
        userId,
        isCompleted: true,
        completedAt: { $gte: lastWeekStart, $lt: lastWeekEnd },
      }),

      // Current week: Average score
      QuizResult.aggregate([
        { $match: { userId, isCompleted: true } },
        { $group: { _id: null, avgScore: { $avg: '$score' } } },
      ]),

      // Last week: Average score
      QuizResult.aggregate([
        {
          $match: {
            userId,
            isCompleted: true,
            completedAt: { $gte: lastWeekStart, $lt: lastWeekEnd },
          },
        },
        { $group: { _id: null, avgScore: { $avg: '$score' } } },
      ]),

      // Current week: Study hours
      StudySession.aggregate([
        { $match: { userId, isCompleted: true } },
        {
          $group: {
            _id: null,
            totalSeconds: { $sum: '$totalDuration' },
          },
        },
      ]),

      // Last week: Study hours
      StudySession.aggregate([
        {
          $match: {
            userId,
            isCompleted: true,
            startTime: { $gte: lastWeekStart, $lt: lastWeekEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalSeconds: { $sum: '$totalDuration' },
          },
        },
      ]),
    ]);

    // Calculate current metrics
    const averageScore = Math.round(avgScoreResult[0]?.avgScore || 0);
    const totalSeconds = studyHoursResult[0]?.totalSeconds || 0;
    const studyHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // Calculate last week metrics
    const avgScoreLastWeek = Math.round(avgScoreLastWeekResult[0]?.avgScore || 0);
    const totalSecondsLastWeek = studyHoursLastWeekResult[0]?.totalSeconds || 0;
    const studyHoursLastWeek = Math.round((totalSecondsLastWeek / 3600) * 10) / 10;

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (!previous || previous === 0) {
        return current > 0 ? 100 : 0;
      }
      const change = ((current - previous) / previous) * 100;
      return Math.round(change);
    };

    const notesChange = calculatePercentageChange(totalNotes, notesLastWeek);
    const quizzesChange = calculatePercentageChange(quizzesCompleted, quizzesLastWeek);
    const scoreChange = calculatePercentageChange(averageScore, avgScoreLastWeek);
    const hoursChange = calculatePercentageChange(studyHours, studyHoursLastWeek);

    // Get last study session time
    const lastSession = await StudySession.findOne({
      userId,
      isCompleted: true,
    })
      .sort({ endTime: -1 })
      .select('endTime')
      .lean();

    // Format last study session time
    let lastStudySessionTime = null;
    if (lastSession?.endTime) {
      const diffMs = now - new Date(lastSession.endTime);
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) {
        lastStudySessionTime = 'Just now';
      } else if (diffMinutes < 60) {
        lastStudySessionTime = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        lastStudySessionTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays === 1) {
        lastStudySessionTime = '1 day ago';
      } else if (diffDays < 7) {
        lastStudySessionTime = `${diffDays} days ago`;
      } else {
        const diffWeeks = Math.floor(diffDays / 7);
        lastStudySessionTime = diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
      }
    }

    logger.info(`Dashboard metrics fetched for user ${userId}`);

    res.json({
      success: true,
      metrics: {
        totalNotes: {
          value: totalNotes,
          change: notesChange,
          trend: notesChange >= 0 ? 'up' : 'down',
        },
        quizzesCompleted: {
          value: quizzesCompleted,
          change: quizzesChange,
          trend: quizzesChange >= 0 ? 'up' : 'down',
        },
        averageScore: {
          value: averageScore,
          change: scoreChange,
          trend: scoreChange >= 0 ? 'up' : 'down',
        },
        studyHours: {
          value: studyHours,
          change: hoursChange,
          trend: hoursChange >= 0 ? 'up' : 'down',
        },
        lastStudySession: lastStudySessionTime,
      },
    });
  } catch (error) {
    logger.error('Get dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard metrics',
    });
  }
};

/**
 * Get quick actions summary
 * GET /api/dashboard/quick-actions
 */
export const getQuickActions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get recent notes count
    const recentNotes = await Note.countDocuments({
      userId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    });

    // Get pending quizzes
    const pendingQuizzes = await QuizResult.countDocuments({
      userId,
      isCompleted: false,
    });

    // Get due flashcards
    const dueFlashcards = await Flashcard.countDocuments({
      userId,
      nextReviewDate: { $lte: new Date() },
    });

    res.json({
      success: true,
      quickActions: {
        recentNotes,
        pendingQuizzes,
        dueFlashcards,
      },
    });
  } catch (error) {
    logger.error('Get quick actions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch quick actions',
    });
  }
};

/**
 * Get recent activity for user
 * GET /api/dashboard/recent-activity?tab=overview|recent
 */
export const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const tab = req.query.tab || 'recent'; // 'overview' or 'recent'
    const limit = parseInt(req.query.limit) || 10;

    let activities = [];

    if (tab === 'overview') {
      // Overview: Get summary of different activity types from Activity collection
      const [quizActivities, noteActivities, flashcardActivities, sessionActivities] = await Promise.all([
        Activity.find({ userId, type: 'quiz' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        Activity.find({ userId, type: 'note' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        Activity.find({ userId, type: 'flashcard' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        Activity.find({ userId, type: 'study_session' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

      // If Activity collection is empty, fetch from source collections
      if (quizActivities.length === 0 && noteActivities.length === 0 && flashcardActivities.length === 0 && sessionActivities.length === 0) {
        // Fetch from actual data sources
        const [quizResults, notes, studySessions] = await Promise.all([
          QuizResult.find({ userId, isCompleted: true })
            .sort({ completedAt: -1 })
            .limit(5)
            .lean(),
          Note.find({ userId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean(),
          StudySession.find({ userId, isCompleted: true })
            .sort({ endTime: -1 })
            .limit(5)
            .lean(),
        ]);

        // Convert to activity format
        const convertedActivities = [
          ...quizResults.map(q => ({
            _id: q._id,
            type: 'quiz',
            subject: q.subject || 'General',
            topic: q.category || q.subject || 'General',
            score: q.score,
            createdAt: q.completedAt || q.startedAt,
            details: {
              mode: q.quizMode,
              totalQuestions: q.totalQuestions,
              correctAnswers: q.correctAnswers,
            },
          })),
          ...notes.map(n => ({
            _id: n._id,
            type: 'note',
            subject: n.subject || 'General',
            topic: n.title,
            score: null,
            createdAt: n.updatedAt || n.createdAt,
            details: {},
          })),
          ...studySessions.map(s => ({
            _id: s._id,
            type: 'study_session',
            subject: s.subject || 'General',
            topic: s.mode,
            score: s.cardsReviewed > 0 ? Math.round((s.cardsCorrect / s.cardsReviewed) * 100) : 0,
            createdAt: s.endTime || s.startTime,
            details: {
              mode: s.mode,
              totalCards: s.totalCards,
              cardsReviewed: s.cardsReviewed,
              completionPercentage: s.completionPercentage,
            },
          })),
        ];

        activities = convertedActivities
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit);
      } else {
        activities = [
          ...quizActivities.map(a => ({ ...a, activityType: 'quiz' })),
          ...noteActivities.map(a => ({ ...a, activityType: 'note' })),
          ...flashcardActivities.map(a => ({ ...a, activityType: 'flashcard' })),
          ...sessionActivities.map(a => ({ ...a, activityType: 'study_session' })),
        ]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit);
      }
    } else {
      // Recent: Get all recent activities from multiple sources
      // Always fetch from source collections to ensure we get real data
      const [activityData, quizResults, notes, studySessions] = await Promise.all([
        Activity.find({ userId })
          .sort({ createdAt: -1 })
          .limit(limit * 2)
          .lean(),
        QuizResult.find({ userId, isCompleted: true })
          .sort({ completedAt: -1, startedAt: -1 })
          .limit(limit * 2)
          .lean(),
        Note.find({ userId })
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(limit * 2)
          .lean(),
        StudySession.find({ userId, isCompleted: true })
          .sort({ endTime: -1, startTime: -1 })
          .limit(limit * 2)
          .lean(),
      ]);

      // Combine all activities from different sources
      const allActivities = [
        // From Activity collection
        ...activityData.map(a => ({
          _id: a._id,
          type: a.type,
          subject: a.subject || 'General',
          topic: a.topic || a.subject || 'General',
          score: a.score || null,
          createdAt: a.createdAt,
          details: a.details || {},
          source: 'activity',
        })),
        // From QuizResults
        ...quizResults
          .filter(q => q.completedAt || q.startedAt)
          .map(q => ({
            _id: q._id,
            type: 'quiz',
            subject: q.subject || 'General',
            topic: q.category || q.subject || 'General',
            score: q.score || null,
            createdAt: q.completedAt || q.startedAt || new Date(),
            details: {
              mode: q.quizMode || 'practice',
              totalQuestions: q.totalQuestions || 0,
              correctAnswers: q.correctAnswers || 0,
            },
            source: 'quiz',
          })),
        // From Notes
        ...notes
          .filter(n => n.createdAt || n.updatedAt)
          .map(n => ({
            _id: n._id,
            type: 'note',
            subject: n.subject || 'General',
            topic: n.title || 'Untitled Note',
            score: null,
            createdAt: n.updatedAt || n.createdAt || new Date(),
            details: {},
            source: 'note',
          })),
        // From StudySessions
        ...studySessions
          .filter(s => s.endTime || s.startTime)
          .map(s => ({
            _id: s._id,
            type: 'study_session',
            subject: s.subject || 'General',
            topic: s.mode || 'standard',
            score: s.cardsReviewed > 0 ? Math.round((s.cardsCorrect / s.cardsReviewed) * 100) : 0,
            createdAt: s.endTime || s.startTime || new Date(),
            details: {
              mode: s.mode || 'standard',
              totalCards: s.totalCards || 0,
              cardsReviewed: s.cardsReviewed || 0,
              completionPercentage: s.completionPercentage || 0,
            },
            source: 'session',
          })),
      ];

      // Remove duplicates (same ID and type) and sort by date
      const uniqueActivities = [];
      const seen = new Set();

      allActivities
        .filter(a => a.createdAt) // Only include activities with valid dates
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .forEach(activity => {
          const key = `${activity.type}-${activity._id}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueActivities.push(activity);
          }
        });

      activities = uniqueActivities.slice(0, limit);
    }

    // Format activities with progress and time labels
    const formattedActivities = activities
      .filter(activity => activity && activity.createdAt) // Filter out invalid activities
      .map(activity => {
        const now = new Date();
        let createdAt;

        // Ensure createdAt is a valid date
        if (activity.createdAt instanceof Date) {
          createdAt = activity.createdAt;
        } else if (typeof activity.createdAt === 'string') {
          createdAt = new Date(activity.createdAt);
        } else {
          createdAt = new Date(); // Fallback to now if invalid
        }

        // Skip if date is invalid
        if (isNaN(createdAt.getTime())) {
          createdAt = new Date();
        }

        const diffMs = now - createdAt;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        let timeLabel = '';
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) {
          timeLabel = 'Just now';
        } else if (diffMinutes < 60) {
          timeLabel = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
          timeLabel = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays === 1) {
          timeLabel = '1 day ago';
        } else if (diffDays < 7) {
          timeLabel = `${diffDays} days ago`;
        } else {
          const diffWeeks = Math.floor(diffDays / 7);
          timeLabel = diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
        }

        // Calculate progress percentage based on activity type
        let progress = 0;
        if (activity.type === 'quiz' && activity.score !== null && activity.score !== undefined) {
          progress = activity.score;
        } else if (activity.type === 'study_session' && activity.details && activity.details.completionPercentage) {
          progress = activity.details.completionPercentage;
        } else if (activity.details && activity.details.progress) {
          progress = activity.details.progress;
        } else if (activity.type === 'quiz') {
          // Default progress for quiz if score not available
          progress = activity.details?.correctAnswers && activity.details?.totalQuestions
            ? Math.round((activity.details.correctAnswers / activity.details.totalQuestions) * 100)
            : 0;
        }

        return {
          _id: activity._id,
          type: activity.type || 'general',
          subject: activity.subject || 'General',
          topic: activity.topic || activity.subject || 'General',
          title: activity.topic && activity.topic !== activity.subject
            ? `${activity.subject || 'General'} - ${activity.topic}`
            : activity.subject || 'General',
          score: activity.score !== undefined && activity.score !== null ? activity.score : null,
          progress: progress,
          timeLabel: timeLabel,
          createdAt: createdAt.toISOString(),
          details: activity.details || {},
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Re-sort after formatting

    res.json({
      success: true,
      tab: tab,
      activities: formattedActivities,
      count: formattedActivities.length,
    });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch recent activity',
    });
  }
};

/**
 * Get current streak for user
 * GET /api/dashboard/streak
 */
export const getCurrentStreak = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all activities from Activity collection
    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Also get dates from source collections if Activity is empty
    const [quizResults, notes, studySessions] = await Promise.all([
      QuizResult.find({ userId, isCompleted: true })
        .select('completedAt startedAt')
        .lean(),
      Note.find({ userId })
        .select('createdAt updatedAt')
        .lean(),
      StudySession.find({ userId, isCompleted: true })
        .select('startTime endTime')
        .lean(),
    ]);

    // Calculate current streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activityDates = new Set();

    // Add dates from Activity collection
    activities.forEach(activity => {
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);
      activityDates.add(activityDate.getTime());
    });

    // Add dates from QuizResults
    quizResults.forEach(quiz => {
      const date = quiz.completedAt || quiz.startedAt;
      if (date) {
        const activityDate = new Date(date);
        activityDate.setHours(0, 0, 0, 0);
        activityDates.add(activityDate.getTime());
      }
    });

    // Add dates from Notes (use updatedAt if available, else createdAt)
    notes.forEach(note => {
      const date = note.updatedAt || note.createdAt;
      if (date) {
        const activityDate = new Date(date);
        activityDate.setHours(0, 0, 0, 0);
        activityDates.add(activityDate.getTime());
      }
    });

    // Add dates from StudySessions
    studySessions.forEach(session => {
      const date = session.endTime || session.startTime;
      if (date) {
        const activityDate = new Date(date);
        activityDate.setHours(0, 0, 0, 0);
        activityDates.add(activityDate.getTime());
      }
    });

    // Calculate current streak (consecutive days with activity)
    let currentStreak = 0;
    let checkDate = new Date(today);

    while (activityDates.has(checkDate.getTime())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate best streak
    const sortedDates = Array.from(activityDates).sort((a, b) => b - a);
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    if (sortedDates.length > 0) {
      for (const date of sortedDates) {
        if (prevDate === null) {
          tempStreak = 1;
        } else {
          const dayDiff = (prevDate - date) / (1000 * 60 * 60 * 24);
          if (Math.abs(dayDiff - 1) < 0.1) { // Allow small floating point differences
            tempStreak++;
          } else {
            bestStreak = Math.max(bestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        prevDate = date;
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    }

    // Calculate streak change this week
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activitiesThisWeek = activities.filter(a => {
      const activityDate = new Date(a.createdAt);
      return activityDate >= weekAgo;
    });

    const weekAgoStreak = await calculateStreakAtDate(userId, weekAgo);
    const streakChange = currentStreak - weekAgoStreak;

    res.json({
      success: true,
      streak: {
        current: currentStreak || 0,
        best: bestStreak || 0,
        changeThisWeek: streakChange || 0,
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
 * Helper function to calculate streak at a specific date
 */
async function calculateStreakAtDate(userId, targetDate) {
  // Get activities from Activity collection
  const activities = await Activity.find({
    userId,
    createdAt: { $lte: targetDate },
  })
    .sort({ createdAt: -1 })
    .lean();

  // Also get from source collections
  const [quizResults, notes, studySessions] = await Promise.all([
    QuizResult.find({
      userId,
      isCompleted: true,
      $or: [
        { completedAt: { $lte: targetDate } },
        { startedAt: { $lte: targetDate } },
      ],
    })
      .select('completedAt startedAt')
      .lean(),
    Note.find({
      userId,
      $or: [
        { createdAt: { $lte: targetDate } },
        { updatedAt: { $lte: targetDate } },
      ],
    })
      .select('createdAt updatedAt')
      .lean(),
    StudySession.find({
      userId,
      isCompleted: true,
      $or: [
        { endTime: { $lte: targetDate } },
        { startTime: { $lte: targetDate } },
      ],
    })
      .select('startTime endTime')
      .lean(),
  ]);

  const activityDates = new Set();

  // Add dates from Activity collection
  activities.forEach(activity => {
    const activityDate = new Date(activity.createdAt);
    activityDate.setHours(0, 0, 0, 0);
    if (activityDate.getTime() <= targetDate.getTime()) {
      activityDates.add(activityDate.getTime());
    }
  });

  // Add dates from QuizResults
  quizResults.forEach(quiz => {
    const date = quiz.completedAt || quiz.startedAt;
    if (date) {
      const activityDate = new Date(date);
      activityDate.setHours(0, 0, 0, 0);
      if (activityDate.getTime() <= targetDate.getTime()) {
        activityDates.add(activityDate.getTime());
      }
    }
  });

  // Add dates from Notes
  notes.forEach(note => {
    const date = note.updatedAt || note.createdAt;
    if (date) {
      const activityDate = new Date(date);
      activityDate.setHours(0, 0, 0, 0);
      if (activityDate.getTime() <= targetDate.getTime()) {
        activityDates.add(activityDate.getTime());
      }
    }
  });

  // Add dates from StudySessions
  studySessions.forEach(session => {
    const date = session.endTime || session.startTime;
    if (date) {
      const activityDate = new Date(date);
      activityDate.setHours(0, 0, 0, 0);
      if (activityDate.getTime() <= targetDate.getTime()) {
        activityDates.add(activityDate.getTime());
      }
    }
  });

  const sortedDates = Array.from(activityDates).sort((a, b) => b - a);
  if (sortedDates.length === 0) return 0;

  let streak = 0;
  let checkDate = new Date(targetDate);
  checkDate.setHours(0, 0, 0, 0);

  while (activityDates.has(checkDate.getTime())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Get upcoming sessions for user
 * GET /api/dashboard/upcoming-sessions
 */
export const getUpcomingSessions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get scheduled study sessions (if you have a scheduling system)
    // For now, we'll create mock upcoming sessions based on recent activity patterns
    const recentActivities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Group by subject to find most studied subjects
    const subjectCounts = {};
    recentActivities.forEach(activity => {
      const subject = activity.subject || 'General';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });

    const topSubjects = Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([subject]) => subject);

    // Generate upcoming sessions based on study patterns
    const upcomingSessions = [];
    const now = new Date();

    // Default subjects if none found
    const defaultSubjects = ['Biology', 'Mathematics', 'Physics', 'Chemistry', 'History'];
    const subjectsToUse = topSubjects.length > 0 ? topSubjects : defaultSubjects;

    // Tomorrow at 2:00 PM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    upcomingSessions.push({
      title: `${subjectsToUse[0]} Review`,
      scheduledAt: tomorrow,
      timeLabel: 'Tomorrow, 2:00 PM',
      subject: subjectsToUse[0],
      type: 'review',
    });

    // In 2 days at 10:00 AM
    const inTwoDays = new Date(now);
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    inTwoDays.setHours(10, 0, 0, 0);

    upcomingSessions.push({
      title: `${subjectsToUse[1] || subjectsToUse[0]} Quiz Prep`,
      scheduledAt: inTwoDays,
      timeLabel: 'In 2 days, 10:00 AM',
      subject: subjectsToUse[1] || subjectsToUse[0],
      type: 'quiz_prep',
    });

    // Sort by scheduled time
    upcomingSessions.sort((a, b) => a.scheduledAt - b.scheduledAt);

    res.json({
      success: true,
      sessions: upcomingSessions,
      count: upcomingSessions.length,
    });
  } catch (error) {
    logger.error('Get upcoming sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch upcoming sessions',
    });
  }
};

/**
 * Get weekly performance metrics
 * GET /api/dashboard/weekly-performance
 */
export const getWeeklyPerformance = async (req, res) => {
  try {
    const userId = req.user._id;

    // Calculate start of current week (Monday)
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay();
    // Calculate days to subtract to get to Monday (0 = Sunday, 1 = Monday, etc.)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setMinutes(0, 0, 0);

    // Study Time: Sum of all study session durations this week
    const studySessions = await StudySession.find({
      userId,
      startTime: { $gte: startOfWeek },
      isCompleted: true,
    }).lean();

    const totalStudySeconds = studySessions.reduce((sum, session) => {
      return sum + (session.totalDuration || 0);
    }, 0);
    const studyHours = Math.round((totalStudySeconds / 3600) * 10) / 10; // Round to 1 decimal

    // Quizzes Passed: Count completed quizzes this week with score >= 70%
    const quizzesThisWeek = await QuizResult.find({
      userId,
      completedAt: { $gte: startOfWeek },
      isCompleted: true,
    }).lean();

    const totalQuizzes = quizzesThisWeek.length;
    const passedQuizzes = quizzesThisWeek.filter(q => q.score >= 70).length;

    // Notes Reviewed: Count notes accessed/updated this week
    // Also include notes that were viewed/studied (via activities)
    const noteActivities = await Activity.find({
      userId,
      type: 'note',
      createdAt: { $gte: startOfWeek },
    }).select('topic subject').lean();

    const noteTopics = [...new Set(noteActivities.map(a => a.topic).filter(Boolean))];
    const noteSubjects = [...new Set(noteActivities.map(a => a.subject).filter(Boolean))];

    const orConditions = [
      { createdAt: { $gte: startOfWeek } },
      { updatedAt: { $gte: startOfWeek } },
    ];

    if (noteTopics.length > 0) {
      orConditions.push({ title: { $in: noteTopics } });
    }
    if (noteSubjects.length > 0) {
      orConditions.push({ subject: { $in: noteSubjects } });
    }

    const notesThisWeek = await Note.find({
      userId,
      $or: orConditions,
    }).lean();

    const totalNotes = await Note.countDocuments({ userId });
    const notesReviewed = notesThisWeek.length;

    const targetStudyHours = 20; // Target hours per week (can be configurable)

    res.json({
      success: true,
      performance: {
        studyTime: {
          value: studyHours || 0,
          unit: 'h',
          total: targetStudyHours,
          percentage: Math.min(100, Math.round(((studyHours || 0) / targetStudyHours) * 100)),
        },
        quizzesPassed: {
          passed: passedQuizzes || 0,
          total: totalQuizzes || 0,
          percentage: totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0,
        },
        notesReviewed: {
          reviewed: notesReviewed || 0,
          total: totalNotes || 0,
          percentage: totalNotes > 0 ? Math.round((notesReviewed / totalNotes) * 100) : 0,
        },
      },
      weekStart: startOfWeek,
      weekEnd: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    logger.error('Get weekly performance error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch weekly performance',
    });
  }
};

