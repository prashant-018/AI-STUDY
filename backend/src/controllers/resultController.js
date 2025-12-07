import QuizResult from '../models/QuizResult.js';

/**
 * Get all quiz results for user
 * GET /api/results
 */
export const getResults = async (req, res) => {
  try {
    const { mode, subject, limit = 20 } = req.query;
    const query = { userId: req.user._id, isCompleted: true };

    if (mode && ['practice', 'timed', 'exam'].includes(mode)) {
      query.quizMode = mode;
    }

    if (subject) {
      query.subject = new RegExp(subject, 'i');
    }

    const results = await QuizResult.find(query)
      .select('-__v')
      .sort({ completedAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch results',
    });
  }
};

/**
 * Get single quiz result by ID
 * GET /api/results/:id
 */
export const getResult = async (req, res) => {
  try {
    const result = await QuizResult.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .populate('questions.questionId', 'question options explanation correctAnswer')
      .select('-__v');

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Quiz result not found',
      });
    }

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch result',
    });
  }
};

/**
 * Get user statistics
 * GET /api/results/stats
 */
export const getStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Overall statistics
    const totalQuizzes = await QuizResult.countDocuments({
      userId,
      isCompleted: true,
    });

    const totalQuestions = await QuizResult.aggregate([
      { $match: { userId, isCompleted: true } },
      { $group: { _id: null, total: { $sum: '$totalQuestions' } } },
    ]);

    const totalCorrect = await QuizResult.aggregate([
      { $match: { userId, isCompleted: true } },
      { $group: { _id: null, total: { $sum: '$correctAnswers' } } },
    ]);

    const averageScore = await QuizResult.aggregate([
      { $match: { userId, isCompleted: true } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]);

    // Mode breakdown
    const modeBreakdown = await QuizResult.aggregate([
      { $match: { userId, isCompleted: true } },
      {
        $group: {
          _id: '$quizMode',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' },
        },
      },
    ]);

    const modeStats = {};
    modeBreakdown.forEach((mode) => {
      modeStats[mode._id] = {
        count: mode.count,
        averageScore: Math.round(mode.avgScore),
      };
    });

    // Subject breakdown
    const subjectBreakdown = await QuizResult.aggregate([
      { $match: { userId, isCompleted: true, subject: { $ne: null } } },
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Recent results
    const recentResults = await QuizResult.find({ userId, isCompleted: true })
      .sort({ completedAt: -1 })
      .limit(10)
      .select('quizMode subject score totalQuestions correctAnswers completedAt');

    res.json({
      success: true,
      stats: {
        totalQuizzes,
        totalQuestions: totalQuestions[0]?.total || 0,
        totalCorrect: totalCorrect[0]?.total || 0,
        averageScore: Math.round(averageScore[0]?.avg || 0),
        accuracyRate:
          totalQuestions[0]?.total > 0
            ? Math.round((totalCorrect[0]?.total / totalQuestions[0]?.total) * 100)
            : 0,
        modeBreakdown: modeStats,
        subjectBreakdown,
        recentResults,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics',
    });
  }
};

/**
 * Delete quiz result
 * DELETE /api/results/:id
 */
export const deleteResult = async (req, res) => {
  try {
    const result = await QuizResult.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Quiz result not found',
      });
    }

    res.json({
      success: true,
      message: 'Quiz result deleted successfully',
    });
  } catch (error) {
    console.error('Delete result error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete result',
    });
  }
};


