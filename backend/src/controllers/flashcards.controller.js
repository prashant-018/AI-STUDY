import Flashcard from '../models/Flashcard.js';
import UserProgress from '../models/UserProgress.js';
import StudySession from '../models/StudySession.js';
import UserSettings from '../models/UserSettings.js';
import { calculateNextReview, updateCardStatistics } from '../utils/spacedRepetition.js';
import { createNotification } from '../services/notification.service.js';
import { createActivity } from './activityController.js';

/**
 * Get all flashcards for user
 * GET /api/flashcards
 */
export const getFlashcards = async (req, res) => {
  try {
    const { status, subject, difficulty, search } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { userId };

    if (status && ['new', 'learning', 'review', 'known', 'mastered'].includes(status)) {
      query.status = status;
    }

    if (subject) {
      query.subject = new RegExp(subject, 'i');
    }

    if (difficulty && ['easy', 'medium', 'advanced'].includes(difficulty)) {
      query.difficulty = difficulty;
    }

    if (search) {
      query.$or = [
        { question: new RegExp(search, 'i') },
        { answer: new RegExp(search, 'i') },
        { subject: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const flashcards = await Flashcard.find(query)
      .sort({ nextReviewDate: 1, createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      count: flashcards.length,
      flashcards,
    });
  } catch (error) {
    console.error('Get flashcards error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch flashcards',
    });
  }
};

/**
 * Get Flashcards Study dashboard data
 * GET /api/flashcards/study-dashboard
 * Returns comprehensive study data matching the flashcards study interface
 */
export const getFlashcardsStudyDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      limit = 6,
      filter = 'all',
      subject,
      mode = 'standard',
      currentCardId
    } = req.query;

    const baseQuery = { userId };
    if (subject) {
      baseQuery.subject = new RegExp(subject, 'i');
    }

    // Filter conditions for card categories
    const filterConditions = {
      all: {}, // All cards
      review: { status: { $in: ['new', 'learning', 'review'] } },
      known: { status: 'known' },
      mastered: { status: 'mastered' },
    };

    const cardsQuery = { ...baseQuery };
    if (filter !== 'all' && filterConditions[filter]) {
      Object.assign(cardsQuery, filterConditions[filter]);
    }

    // Sort options based on study mode
    const sortOptions = {
      standard: { nextReviewDate: 1, masteryLevel: 1 },
      quick_review: { nextReviewDate: 1 },
      exam_mode: { masteryLevel: 1, reviewCount: 1 },
    };

    const sortOption = sortOptions[mode] || sortOptions.standard;

    // Get paginated cards for display
    const cards = await Flashcard.find(cardsQuery)
      .sort(sortOption)
      .limit(parseInt(limit) || 50)
      .lean();

    // Get current card details if provided
    let currentCard = null;
    if (currentCardId) {
      currentCard = await Flashcard.findOne({
        _id: currentCardId,
        userId,
      }).lean();
    } else if (cards.length > 0) {
      // Use first card as current if no specific card requested
      currentCard = cards[0];
    }

    // Aggregate statistics
    const cardStatsArray = await Flashcard.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          known: { $sum: { $cond: [{ $eq: ['$status', 'known'] }, 1, 0] } },
          mastered: { $sum: { $cond: [{ $eq: ['$status', 'mastered'] }, 1, 0] } },
          review: {
            $sum: {
              $cond: [
                { $in: ['$status', ['new', 'learning', 'review']] },
                1,
                0,
              ],
            },
          },
          totalReviews: { $sum: { $ifNull: ['$reviewCount', 0] } },
          averageMastery: { $avg: { $ifNull: ['$masteryLevel', 0] } },
        },
      },
    ]);

    const cardStats = cardStatsArray && cardStatsArray.length > 0 ? cardStatsArray[0] : null;

    // Calculate mastery progress percentage
    const totalCards = cardStats?.total || 0;
    const knownCards = cardStats?.known || 0;
    const masteredCards = cardStats?.mastered || 0;
    const masteryProgress = totalCards > 0
      ? Math.round(((knownCards + masteredCards) / totalCards) * 100)
      : 0;

    // Get user progress and settings
    const userProgress = await UserProgress.findOne({ userId }).lean();
    const userSettings = await UserSettings.findOne({ userId }).lean();

    // Get recent study sessions
    const lastSessions = await StudySession.find({ userId })
      .sort({ startTime: -1 })
      .limit(3)
      .lean();

    // Format current card details if available
    let cardDetails = null;
    if (currentCard) {
      const lastReviewDate = currentCard.lastReviewDate || currentCard.createdAt;
      cardDetails = {
        difficulty: currentCard.difficulty || 'medium',
        masteryLevel: currentCard.masteryLevel || 0,
        reviewCount: currentCard.reviewCount || 0,
        lastReviewed: lastReviewDate ? formatRelativeTime(lastReviewDate) : 'Never',
        nextReviewDate: currentCard.nextReviewDate,
        status: currentCard.status || 'new',
        easeFactor: currentCard.easeFactor || 2.5,
        repetitions: currentCard.repetitions || 0,
      };
    }

    res.json({
      success: true,
      // Study Progress Data
      studyProgress: {
        masteryProgress: masteryProgress,
        knownCount: knownCards,
        masteredCount: masteredCards,
        totalReviews: cardStats?.totalReviews || 0,
      },
      // Current Card Details
      cardDetails: cardDetails,
      // Card Categories Count
      cardCategories: {
        all: totalCards,
        review: cardStats?.review || 0,
        known: knownCards,
        mastered: masteredCards,
      },
      // Cards List
      cards: (cards || []).map((card, index) => ({
        _id: card._id,
        question: card.question || '',
        answer: card.answer || '',
        hint: card.hint || '',
        subject: card.subject || 'General',
        category: card.category || card.subject || 'General',
        difficulty: card.difficulty || 'medium',
        tags: Array.isArray(card.tags) ? card.tags : [],
        status: card.status || 'new',
        masteryLevel: card.masteryLevel || 0,
        reviewCount: card.reviewCount || 0,
        lastReviewDate: card.lastReviewDate,
        nextReviewDate: card.nextReviewDate,
        isCurrent: currentCardId ? card._id.toString() === currentCardId : index === 0,
      })),
      // Study Settings
      studySettings: {
        autoFlip: userSettings?.flashcardSettings?.autoFlip || false,
        showHints: userSettings?.flashcardSettings?.showHints !== false,
      },
      // Overview Stats
      overview: {
        totalCards,
        reviewCards: cardStats?.review || 0,
        knownCards,
        masteredCards,
        masteryProgress,
        averageMastery: Math.round(cardStats?.averageMastery || 0),
        totalReviews: cardStats?.totalReviews || 0,
      },
      // Study Modes Info
      studyModes: {
        standard: {
          label: 'Standard',
          description: 'Balanced study session',
          cardsAvailable: totalCards,
        },
        quick_review: {
          label: 'Quick Review',
          description: 'Focus on due cards',
          cardsAvailable: cardStats?.review || 0,
        },
        exam_mode: {
          label: 'Exam Mode',
          description: 'Intensive practice',
          cardsAvailable: totalCards,
        },
      },
    });
  } catch (error) {
    console.error('Study dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch study dashboard data',
    });
  }
};

/**
 * Get single flashcard by ID
 * GET /api/flashcards/:id
 */
export const getFlashcard = async (req, res) => {
  try {
    const flashcard = await Flashcard.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).select('-__v');

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found',
      });
    }

    res.json({
      success: true,
      flashcard,
    });
  } catch (error) {
    console.error('Get flashcard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch flashcard',
    });
  }
};

/**
 * Create new flashcard
 * POST /api/flashcards
 */
export const createFlashcard = async (req, res) => {
  try {
    const { question, answer, hint, subject, category, tags, difficulty } = req.body;

    if (!question || !answer || !subject) {
      return res.status(400).json({
        success: false,
        error: 'question, answer, and subject are required',
      });
    }

    const flashcard = new Flashcard({
      userId: req.user._id,
      question,
      answer,
      hint: hint || '',
      subject,
      category: category || 'General',
      tags: Array.isArray(tags) ? tags : [],
      difficulty: difficulty || 'medium',
      nextReviewDate: new Date(), // Available for review immediately
    });

    await flashcard.save();

    // Update user progress
    await updateUserProgress(req.user._id);

    // Track activity
    await createActivity(req.user._id, 'flashcard', {
      subject: flashcard.subject,
      topic: flashcard.category,
      details: {
        action: 'created',
        flashcardId: flashcard._id.toString(),
      },
    });

    // Create notification for flashcard saved
    createNotification({
      userId: req.user._id,
      type: 'flashcards_saved',
      metadata: { flashcardId: flashcard._id.toString(), subject: flashcard.subject },
      relatedId: flashcard._id,
      relatedType: 'flashcard',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    res.status(201).json({
      success: true,
      flashcard: flashcard.toObject(),
    });
  } catch (error) {
    console.error('Create flashcard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create flashcard',
    });
  }
};

/**
 * Update flashcard
 * PUT /api/flashcards/:id
 */
export const updateFlashcard = async (req, res) => {
  try {
    const { question, answer, hint, subject, category, tags, difficulty } = req.body;

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (hint !== undefined) updateData.hint = hint;
    if (subject !== undefined) updateData.subject = subject;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (difficulty !== undefined) updateData.difficulty = difficulty;

    const flashcard = await Flashcard.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found',
      });
    }

    res.json({
      success: true,
      flashcard,
    });
  } catch (error) {
    console.error('Update flashcard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update flashcard',
    });
  }
};

/**
 * Delete flashcard
 * DELETE /api/flashcards/:id
 */
export const deleteFlashcard = async (req, res) => {
  try {
    const flashcard = await Flashcard.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found',
      });
    }

    // Update user progress
    await updateUserProgress(req.user._id);

    // Create notification for flashcard deleted
    createNotification({
      userId: req.user._id,
      type: 'flashcard_deleted',
      metadata: { flashcardId: flashcard._id.toString(), subject: flashcard.subject },
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    res.json({
      success: true,
      message: 'Flashcard deleted successfully',
    });
  } catch (error) {
    console.error('Delete flashcard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete flashcard',
    });
  }
};

/**
 * Review flashcard (update spaced repetition data)
 * POST /api/flashcards/:id/review
 */
export const reviewFlashcard = async (req, res) => {
  try {
    const { quality, responseTime } = req.body;

    if (quality === undefined || quality < 0 || quality > 5) {
      return res.status(400).json({
        success: false,
        error: 'quality (0-5) is required',
      });
    }

    const flashcard = await Flashcard.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found',
      });
    }

    // Calculate spaced repetition updates
    const isCorrect = quality >= 3;
    const srUpdate = calculateNextReview(flashcard, quality);
    const statsUpdate = updateCardStatistics(flashcard, isCorrect, responseTime || 0);

    // Update flashcard
    flashcard.easeFactor = srUpdate.easeFactor;
    flashcard.interval = srUpdate.interval;
    flashcard.repetitions = srUpdate.repetitions;
    flashcard.nextReviewDate = srUpdate.nextReviewDate;
    flashcard.status = srUpdate.status;
    flashcard.masteryLevel = srUpdate.masteryLevel;
    flashcard.lastReviewDate = new Date();
    flashcard.reviewCount = statsUpdate.reviewCount;
    flashcard.correctCount = statsUpdate.correctCount;
    flashcard.incorrectCount = statsUpdate.incorrectCount;
    flashcard.averageResponseTime = statsUpdate.averageResponseTime;

    await flashcard.save();

    // Update user progress
    await updateUserProgress(req.user._id);

    // Track review activity
    await createActivity(req.user._id, 'flashcard', {
      subject: flashcard.subject,
      topic: flashcard.category,
      score: Math.round(flashcard.masteryLevel || 0),
      details: {
        action: 'review',
        quality,
        isCorrect,
        status: flashcard.status,
        masteryLevel: flashcard.masteryLevel,
        flashcardId: flashcard._id.toString(),
      },
    });

    res.json({
      success: true,
      flashcard: flashcard.toObject(),
      updated: {
        status: srUpdate.status,
        nextReviewDate: srUpdate.nextReviewDate,
        masteryLevel: srUpdate.masteryLevel,
      },
    });
  } catch (error) {
    console.error('Review flashcard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to review flashcard',
    });
  }
};

/**
 * Mark flashcard as known
 * POST /api/flashcards/:id/mark-known
 */
export const markFlashcardKnown = async (req, res) => {
  try {
    const flashcard = await Flashcard.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        status: 'known',
        masteryLevel: 75,
        nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      { new: true }
    ).select('-__v');

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found',
      });
    }

    await updateUserProgress(req.user._id);

    await createActivity(req.user._id, 'flashcard', {
      subject: flashcard.subject,
      topic: flashcard.category,
      score: flashcard.masteryLevel,
      details: {
        action: 'mark_known',
        flashcardId: flashcard._id.toString(),
      },
    });

    res.json({
      success: true,
      flashcard,
    });
  } catch (error) {
    console.error('Mark known error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark flashcard as known',
    });
  }
};

/**
 * Mark flashcard as mastered
 * POST /api/flashcards/:id/mark-mastered
 */
export const markFlashcardMastered = async (req, res) => {
  try {
    const flashcard = await Flashcard.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        status: 'mastered',
        masteryLevel: 100,
        repetitions: 10,
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      },
      { new: true }
    ).select('-__v');

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found',
      });
    }

    await updateUserProgress(req.user._id);

    await createActivity(req.user._id, 'flashcard', {
      subject: flashcard.subject,
      topic: flashcard.category,
      score: flashcard.masteryLevel,
      details: {
        action: 'mark_mastered',
        flashcardId: flashcard._id.toString(),
      },
    });

    res.json({
      success: true,
      flashcard,
    });
  } catch (error) {
    console.error('Mark mastered error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark flashcard as mastered',
    });
  }
};

/**
 * Get cards due for review
 * GET /api/flashcards/due
 */
export const getDueCards = async (req, res) => {
  try {
    const { subject, limit } = req.query;
    const userId = req.user._id;

    const query = {
      userId,
      nextReviewDate: { $lte: new Date() },
    };

    if (subject) {
      query.subject = new RegExp(subject, 'i');
    }

    const cards = await Flashcard.find(query)
      .sort({ nextReviewDate: 1 })
      .limit(limit ? parseInt(limit) : 50)
      .select('-__v');

    res.json({
      success: true,
      count: cards.length,
      cards,
    });
  } catch (error) {
    console.error('Get due cards error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch due cards',
    });
  }
};

/**
 * Helper function to update user progress
 */
async function updateUserProgress(userId) {
  try {
    const stats = await Flashcard.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          known: {
            $sum: { $cond: [{ $eq: ['$status', 'known'] }, 1, 0] },
          },
          mastered: {
            $sum: { $cond: [{ $eq: ['$status', 'mastered'] }, 1, 0] },
          },
          review: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$status', 'review'] },
                    { $eq: ['$status', 'learning'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const statsData = stats[0] || { total: 0, known: 0, mastered: 0, review: 0 };

    let userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      userProgress = new UserProgress({ userId });
    }

    userProgress.totalFlashcards = statsData.total;
    userProgress.knownCards = statsData.known;
    userProgress.masteredCards = statsData.mastered;
    userProgress.reviewCards = statsData.review;

    // Calculate mastery progress
    if (statsData.total > 0) {
      userProgress.masteryProgress = Math.round(
        ((statsData.known + statsData.mastered) / statsData.total) * 100
      );
    }

    await userProgress.save();
  } catch (error) {
    console.error('Update user progress error:', error);
  }
}

function difficultyToLabel(difficulty) {
  const map = {
    advanced: 'hard',
    hard: 'hard',
    medium: 'medium',
    easy: 'easy',
  };
  return map[difficulty] || 'medium';
}

function formatRelativeTime(date) {
  if (!date) return 'Never';
  const now = new Date();
  const diff = now - new Date(date);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Update flashcard study settings
 * PUT /api/flashcards/settings
 */
export const updateFlashcardSettings = async (req, res) => {
  try {
    const { autoFlip, showHints, defaultMode, cardsPerSession } = req.body;
    const userId = req.user._id;

    let userSettings = await UserSettings.findOne({ userId });

    if (!userSettings) {
      userSettings = await UserSettings.createDefault(userId);
    }

    // Update flashcard settings
    if (autoFlip !== undefined) {
      userSettings.flashcardSettings = userSettings.flashcardSettings || {};
      userSettings.flashcardSettings.autoFlip = autoFlip;
    }

    if (showHints !== undefined) {
      userSettings.flashcardSettings = userSettings.flashcardSettings || {};
      userSettings.flashcardSettings.showHints = showHints;
    }

    if (defaultMode !== undefined && ['standard', 'quick_review', 'exam_mode'].includes(defaultMode)) {
      userSettings.flashcardSettings = userSettings.flashcardSettings || {};
      userSettings.flashcardSettings.defaultMode = defaultMode;
    }

    if (cardsPerSession !== undefined) {
      userSettings.flashcardSettings = userSettings.flashcardSettings || {};
      userSettings.flashcardSettings.cardsPerSession = Math.max(5, Math.min(100, cardsPerSession));
    }

    await userSettings.save();

    res.json({
      success: true,
      settings: {
        autoFlip: userSettings.flashcardSettings?.autoFlip || false,
        showHints: userSettings.flashcardSettings?.showHints !== false,
        defaultMode: userSettings.flashcardSettings?.defaultMode || 'standard',
        cardsPerSession: userSettings.flashcardSettings?.cardsPerSession || 20,
      },
    });
  } catch (error) {
    console.error('Update flashcard settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update flashcard settings',
    });
  }
};

function getStudyModeRecommendations({ cardStats, dueToday, dueThisWeek, lastSessions }) {
  const stats = cardStats || {};
  const completion = lastSessions?.[0]?.completionPercentage || 0;

  return {
    standard: {
      label: 'Standard',
      recommendation: stats.total ? 'Balanced session across all cards' : 'Add cards to start studying',
      cardsAvailable: stats.total || 0,
    },
    quickReview: {
      label: 'Quick Review',
      recommendation: dueToday > 0 ? 'Clear due cards for today' : 'Great job! No cards due today.',
      cardsDue: dueToday,
    },
    examMode: {
      label: 'Exam Mode',
      recommendation:
        stats.review > 0
          ? 'Focus on cards below mastery 70%'
          : 'Most cards are well mastered. Keep practicing!',
      cardsToFocus: stats.review || 0,
      lastSessionCompletion: completion,
    },
  };
}



