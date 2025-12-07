/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm
 */

/**
 * Calculate next review date and update card parameters
 * @param {Object} card - Flashcard object
 * @param {Number} quality - User response quality (0-5)
 *   0 = Complete blackout
 *   1 = Incorrect, but recognized
 *   2 = Incorrect, but easy to recall
 *   3 = Correct, but difficult
 *   4 = Correct, with some hesitation
 *   5 = Perfect response
 * @returns {Object} Updated card parameters
 */
export function calculateNextReview(card, quality) {
  let { easeFactor, interval, repetitions } = card;

  // Update ease factor based on quality
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate new interval
  if (quality < 3) {
    // Incorrect answer - reset
    repetitions = 0;
    interval = 0;
  } else {
    // Correct answer
    repetitions += 1;

    if (repetitions === 1) {
      interval = 1; // 1 day
    } else if (repetitions === 2) {
      interval = 6; // 6 days
    } else {
      interval = Math.ceil(interval * easeFactor);
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  // Determine card status based on repetitions
  let status = 'learning';
  if (repetitions === 0) {
    status = 'new';
  } else if (repetitions >= 1 && repetitions < 3) {
    status = 'learning';
  } else if (repetitions >= 3 && repetitions < 5) {
    status = 'review';
  } else if (repetitions >= 5 && repetitions < 8) {
    status = 'known';
  } else {
    status = 'mastered';
  }

  // Calculate mastery level (0-100%)
  const masteryLevel = Math.min(100, Math.floor((repetitions / 10) * 100));

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate,
    status,
    masteryLevel,
  };
}

/**
 * Get cards due for review
 * @param {Date} currentDate - Current date
 * @returns {Object} Query object for finding due cards
 */
export function getDueCardsQuery(currentDate = new Date()) {
  return {
    nextReviewDate: { $lte: currentDate },
  };
}

/**
 * Calculate mastery percentage for a set of cards
 * @param {Array} cards - Array of flashcard objects
 * @returns {Number} Mastery percentage (0-100)
 */
export function calculateMasteryPercentage(cards) {
  if (!cards || cards.length === 0) return 0;

  const totalMastery = cards.reduce((sum, card) => sum + (card.masteryLevel || 0), 0);
  return Math.round(totalMastery / cards.length);
}

/**
 * Get cards by status
 * @param {String} status - Card status (new, learning, review, known, mastered)
 * @returns {Object} Query object
 */
export function getCardsByStatus(status) {
  return { status };
}

/**
 * Update card statistics after review
 * @param {Object} card - Flashcard object
 * @param {Boolean} isCorrect - Whether the answer was correct
 * @param {Number} responseTime - Response time in milliseconds
 * @returns {Object} Updated statistics
 */
export function updateCardStatistics(card, isCorrect, responseTime = 0) {
  const reviewCount = (card.reviewCount || 0) + 1;
  const correctCount = isCorrect ? (card.correctCount || 0) + 1 : card.correctCount || 0;
  const incorrectCount = !isCorrect ? (card.incorrectCount || 0) + 1 : card.incorrectCount || 0;

  // Calculate average response time
  const currentAvgTime = card.averageResponseTime || 0;
  const averageResponseTime = Math.round(
    (currentAvgTime * (reviewCount - 1) + responseTime) / reviewCount
  );

  return {
    reviewCount,
    correctCount,
    incorrectCount,
    averageResponseTime,
  };
}



