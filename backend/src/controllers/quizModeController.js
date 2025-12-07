import Question from '../models/Question.js';
import QuizResult from '../models/QuizResult.js';
import { createActivity } from './activityController.js';
import { createNotification } from '../services/notification.service.js';

/**
 * Start a quiz
 * POST /api/quiz/start
 */
export const startQuiz = async (req, res) => {
  try {
    const { mode, subject, category, difficulty, questionCount = 10 } = req.body;

    if (!mode || !['practice', 'timed', 'exam'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'mode is required and must be: practice, timed, or exam',
      });
    }

    // Build query for questions
    const query = { isActive: true };

    if (subject) {
      query.subject = new RegExp(subject, 'i');
    }

    if (category) {
      query.category = new RegExp(category, 'i');
    }

    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      query.difficulty = difficulty;
    }

    // Get random questions
    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: parseInt(questionCount) } },
      {
        $project: {
          question: 1,
          options: 1,
          explanation: 1,
          subject: 1,
          category: 1,
          difficulty: 1,
          points: 1,
          timeLimit: 1,
        },
      },
    ]);

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No questions found matching the criteria',
      });
    }

    // Calculate total time limit for timed/exam mode
    let totalTimeLimit = null;
    if (mode === 'timed' || mode === 'exam') {
      totalTimeLimit = questions.reduce((sum, q) => sum + (q.timeLimit || 60), 0);
    }

    // Create quiz result record
    const quizResult = new QuizResult({
      userId: req.user._id,
      quizMode: mode,
      subject: subject || null,
      category: category || null,
      difficulty: difficulty || 'mixed',
      totalQuestions: questions.length,
      correctAnswers: 0,
      incorrectAnswers: 0,
      score: 0,
      totalPoints: questions.reduce((sum, q) => sum + (q.points || 10), 0),
      earnedPoints: 0,
      timeLimit: totalTimeLimit,
      questions: [],
      isCompleted: false,
    });

    await quizResult.save();

    // Create notification for quiz generated
    createNotification({
      userId: req.user._id,
      type: 'quiz_generated',
      metadata: {
        quizId: quizResult._id.toString(),
        mode: quizResult.quizMode,
        questionCount: questions.length
      },
      relatedId: quizResult._id,
      relatedType: 'quiz',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    res.status(201).json({
      success: true,
      quiz: {
        quizId: quizResult._id,
        mode: quizResult.quizMode,
        totalQuestions: quizResult.totalQuestions,
        timeLimit: quizResult.timeLimit,
        startedAt: quizResult.startedAt,
      },
      questions: questions.map((q) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        subject: q.subject,
        category: q.category,
        difficulty: q.difficulty,
        points: q.points,
        timeLimit: q.timeLimit,
      })),
    });
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start quiz',
    });
  }
};

/**
 * Submit quiz answer
 * POST /api/quiz/:quizId/answer
 */
export const submitAnswer = async (req, res) => {
  try {
    const { questionId, userAnswer, timeSpent } = req.body;

    if (questionId === undefined || userAnswer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'questionId and userAnswer are required',
      });
    }

    const quizResult = await QuizResult.findOne({
      _id: req.params.quizId,
      userId: req.user._id,
      isCompleted: false,
    });

    if (!quizResult) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found or already completed',
      });
    }

    // Get question details
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }

    // Check if question already answered
    const existingAnswer = quizResult.questions.find(
      (q) => q.questionId.toString() === questionId.toString()
    );

    if (existingAnswer) {
      return res.status(400).json({
        success: false,
        error: 'Question already answered',
      });
    }

    // Check answer
    const isCorrect = userAnswer === question.correctAnswer;
    const points = isCorrect ? question.points : 0;

    // Update quiz result
    if (isCorrect) {
      quizResult.correctAnswers += 1;
      quizResult.earnedPoints += points;
    } else {
      quizResult.incorrectAnswers += 1;
    }

    quizResult.questions.push({
      questionId: question._id,
      question: question.question,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      timeSpent: timeSpent || 0,
      points,
    });

    await quizResult.save();

    res.json({
      success: true,
      result: {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        points,
        currentScore: Math.round((quizResult.earnedPoints / quizResult.totalPoints) * 100),
      },
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit answer',
    });
  }
};

/**
 * Complete quiz
 * POST /api/quiz/:quizId/complete
 */
export const completeQuiz = async (req, res) => {
  try {
    const { timeSpent } = req.body;

    const quizResult = await QuizResult.findOne({
      _id: req.params.quizId,
      userId: req.user._id,
      isCompleted: false,
    });

    if (!quizResult) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found or already completed',
      });
    }

    // Calculate final score
    const score = Math.round((quizResult.earnedPoints / quizResult.totalPoints) * 100);

    quizResult.score = score;
    quizResult.timeSpent = timeSpent || 0;
    quizResult.completedAt = new Date();
    quizResult.isCompleted = true;

    await quizResult.save();

    // Create activity record
    await createActivity(req.user._id, 'quiz', {
      subject: quizResult.subject,
      topic: quizResult.category,
      score: quizResult.score,
      details: {
        mode: quizResult.quizMode,
        totalQuestions: quizResult.totalQuestions,
        correctAnswers: quizResult.correctAnswers,
      },
    });

    // Create notifications for quiz completion
    createNotification({
      userId: req.user._id,
      type: 'quiz_finished',
      metadata: {
        quizId: quizResult._id.toString(),
        score: quizResult.score,
        mode: quizResult.quizMode
      },
      relatedId: quizResult._id,
      relatedType: 'quiz',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    createNotification({
      userId: req.user._id,
      type: 'quiz_results_ready',
      metadata: {
        quizId: quizResult._id.toString(),
        score: quizResult.score
      },
      relatedId: quizResult._id,
      relatedType: 'quiz',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    res.json({
      success: true,
      result: {
        quizId: quizResult._id,
        totalQuestions: quizResult.totalQuestions,
        correctAnswers: quizResult.correctAnswers,
        incorrectAnswers: quizResult.incorrectAnswers,
        score: quizResult.score,
        totalPoints: quizResult.totalPoints,
        earnedPoints: quizResult.earnedPoints,
        timeSpent: quizResult.timeSpent,
        completedAt: quizResult.completedAt,
        questions: quizResult.questions,
      },
    });
  } catch (error) {
    console.error('Complete quiz error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete quiz',
    });
  }
};

/**
 * Get quiz status
 * GET /api/quiz/:quizId
 */
export const getQuizStatus = async (req, res) => {
  try {
    const quizResult = await QuizResult.findOne({
      _id: req.params.quizId,
      userId: req.user._id,
    }).populate('questions.questionId', 'question options explanation');

    if (!quizResult) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found',
      });
    }

    res.json({
      success: true,
      quiz: {
        quizId: quizResult._id,
        mode: quizResult.quizMode,
        subject: quizResult.subject,
        category: quizResult.category,
        difficulty: quizResult.difficulty,
        totalQuestions: quizResult.totalQuestions,
        correctAnswers: quizResult.correctAnswers,
        incorrectAnswers: quizResult.incorrectAnswers,
        score: quizResult.score,
        timeSpent: quizResult.timeSpent,
        timeLimit: quizResult.timeLimit,
        isCompleted: quizResult.isCompleted,
        startedAt: quizResult.startedAt,
        completedAt: quizResult.completedAt,
        questionsAnswered: quizResult.questions.length,
        questions: quizResult.questions,
      },
    });
  } catch (error) {
    console.error('Get quiz status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch quiz status',
    });
  }
};

