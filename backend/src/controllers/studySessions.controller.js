import StudySession from '../models/StudySession.js';
import Flashcard from '../models/Flashcard.js';
import UserProgress from '../models/UserProgress.js';
import { getDueCardsQuery } from '../utils/spacedRepetition.js';
import { createActivity } from './activityController.js';

/**
 * Start a new study session
 * POST /api/study-sessions/start
 */
export const startStudySession = async (req, res) => {
  try {
    const { mode, subject, settings } = req.body;

    if (!mode || !['standard', 'quick_review', 'exam_mode'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'mode is required and must be: standard, quick_review, or exam_mode',
      });
    }

    // Get cards for study session based on mode
    let cards = [];
    const query = { userId: req.user._id };

    if (subject) {
      query.subject = new RegExp(subject, 'i');
    }

    switch (mode) {
      case 'standard':
        // Get all cards or due cards
        cards = await Flashcard.find(query).sort({ nextReviewDate: 1 }).limit(50);
        break;
      case 'quick_review':
        // Get only due cards
        query.nextReviewDate = { $lte: new Date() };
        cards = await Flashcard.find(query).sort({ nextReviewDate: 1 }).limit(30);
        break;
      case 'exam_mode':
        // Get cards that need review (not mastered)
        query.status = { $in: ['new', 'learning', 'review', 'known'] };
        cards = await Flashcard.find(query).sort({ masteryLevel: 1 }).limit(100);
        break;
    }

    if (cards.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No cards available for study',
      });
    }

    // Create study session
    const session = new StudySession({
      userId: req.user._id,
      mode,
      subject: subject || null,
      totalCards: cards.length,
      settings: {
        autoFlip: settings?.autoFlip || false,
        showHints: settings?.showHints !== false,
      },
    });

    await session.save();

    res.status(201).json({
      success: true,
      session: {
        _id: session._id,
        mode: session.mode,
        subject: session.subject,
        totalCards: session.totalCards,
        settings: session.settings,
        startTime: session.startTime,
      },
      cards: cards.map((card) => ({
        _id: card._id,
        question: card.question,
        answer: card.answer,
        hint: card.hint,
        subject: card.subject,
        difficulty: card.difficulty,
        status: card.status,
        masteryLevel: card.masteryLevel,
      })),
    });
  } catch (error) {
    console.error('Start study session error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start study session',
    });
  }
};

/**
 * Update study session progress
 * POST /api/study-sessions/:id/progress
 */
export const updateSessionProgress = async (req, res) => {
  try {
    const { cardId, isCorrect, quality, responseTime, markedKnown, markedMastered } = req.body;

    const session = await StudySession.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Study session not found',
      });
    }

    // Update session stats
    session.cardsReviewed += 1;

    if (isCorrect) {
      session.cardsCorrect += 1;
    } else {
      session.cardsIncorrect += 1;
    }

    if (markedKnown) {
      session.cardsMarkedKnown += 1;
    }

    if (markedMastered) {
      session.cardsMastered += 1;
    }

    // Update completion percentage
    session.completionPercentage = Math.round(
      (session.cardsReviewed / session.totalCards) * 100
    );

    await session.save();

    res.json({
      success: true,
      session: {
        _id: session._id,
        cardsReviewed: session.cardsReviewed,
        cardsCorrect: session.cardsCorrect,
        cardsIncorrect: session.cardsIncorrect,
        completionPercentage: session.completionPercentage,
      },
    });
  } catch (error) {
    console.error('Update session progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update session progress',
    });
  }
};

/**
 * Complete study session
 * POST /api/study-sessions/:id/complete
 */
export const completeStudySession = async (req, res) => {
  try {
    const session = await StudySession.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Study session not found',
      });
    }

    if (session.isCompleted) {
      return res.status(400).json({
        success: false,
        error: 'Session already completed',
      });
    }

    // Calculate duration
    const endTime = new Date();
    const totalDuration = Math.round((endTime - session.startTime) / 1000); // seconds
    const averageTimePerCard =
      session.cardsReviewed > 0 ? Math.round(totalDuration / session.cardsReviewed) : 0;

    session.endTime = endTime;
    session.totalDuration = totalDuration;
    session.averageTimePerCard = averageTimePerCard;
    session.isCompleted = true;
    session.completionPercentage = 100;

    await session.save();

    // Create activity record
    const accuracyRate =
      session.cardsReviewed > 0
        ? Math.round((session.cardsCorrect / session.cardsReviewed) * 100)
        : 0;

    await createActivity(req.user._id, 'study_session', {
      subject: session.subject,
      topic: session.mode,
      score: accuracyRate,
      details: {
        mode: session.mode,
        totalCards: session.totalCards,
        cardsReviewed: session.cardsReviewed,
        cardsCorrect: session.cardsCorrect,
      },
    });

    // Update user progress
    await updateUserProgressStats(req.user._id, session);

    res.json({
      success: true,
      session: session.toObject(),
    });
  } catch (error) {
    console.error('Complete study session error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete study session',
    });
  }
};

/**
 * Get study session by ID
 * GET /api/study-sessions/:id
 */
export const getStudySession = async (req, res) => {
  try {
    const session = await StudySession.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).select('-__v');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Study session not found',
      });
    }

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Get study session error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch study session',
    });
  }
};

/**
 * Get all study sessions for user
 * GET /api/study-sessions
 */
export const getStudySessions = async (req, res) => {
  try {
    const { mode, limit = 20 } = req.query;
    const query = { userId: req.user._id };

    if (mode && ['standard', 'quick_review', 'exam_mode'].includes(mode)) {
      query.mode = mode;
    }

    const sessions = await StudySession.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error('Get study sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch study sessions',
    });
  }
};

/**
 * Helper function to update user progress after session
 */
async function updateUserProgressStats(userId, session) {
  try {
    let userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      userProgress = new UserProgress({ userId });
    }

    userProgress.totalStudySessions += 1;
    userProgress.totalReviews += session.cardsReviewed;
    userProgress.totalStudyTime += Math.round(session.totalDuration / 60); // Convert to minutes

    // Update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (userProgress.lastStudyDate) {
      const lastStudy = new Date(userProgress.lastStudyDate);
      lastStudy.setHours(0, 0, 0, 0);

      const daysDiff = Math.round((today - lastStudy) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day
        userProgress.currentStreak += 1;
      } else if (daysDiff > 1) {
        // Streak broken
        userProgress.currentStreak = 1;
      }
      // If daysDiff === 0, same day, don't update streak
    } else {
      // First study session
      userProgress.currentStreak = 1;
    }

    if (userProgress.currentStreak > userProgress.longestStreak) {
      userProgress.longestStreak = userProgress.currentStreak;
    }

    userProgress.lastStudyDate = new Date();

    await userProgress.save();
  } catch (error) {
    console.error('Update user progress stats error:', error);
  }
}


