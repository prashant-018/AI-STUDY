import Question from '../models/Question.js';

/**
 * Get all questions
 * GET /api/questions
 */
export const getQuestions = async (req, res) => {
  try {
    const { subject, category, difficulty, search, limit = 50 } = req.query;
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

    if (search) {
      query.$or = [
        { question: new RegExp(search, 'i') },
        { explanation: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const questions = await Question.find(query)
      .select('-__v')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch questions',
    });
  }
};

/**
 * Get single question by ID
 * GET /api/questions/:id
 */
export const getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).select('-__v');

    if (!question || !question.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      question,
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch question',
    });
  }
};

/**
 * Create new question
 * POST /api/questions
 */
export const createQuestion = async (req, res) => {
  try {
    const {
      question,
      options,
      correctAnswer,
      explanation,
      subject,
      category,
      difficulty,
      tags,
      points,
      timeLimit,
    } = req.body;

    // Validation
    if (!question || !options || correctAnswer === undefined || !subject) {
      return res.status(400).json({
        success: false,
        error: 'question, options, correctAnswer, and subject are required',
      });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'options must be an array with at least 2 items',
      });
    }

    if (correctAnswer < 0 || correctAnswer >= options.length) {
      return res.status(400).json({
        success: false,
        error: 'correctAnswer index is out of range',
      });
    }

    const newQuestion = new Question({
      question,
      options,
      correctAnswer,
      explanation: explanation || '',
      subject,
      category: category || 'General',
      difficulty: difficulty || 'medium',
      tags: Array.isArray(tags) ? tags : [],
      points: points || 10,
      timeLimit: timeLimit || 60,
      userId: req.user?._id || null,
    });

    await newQuestion.save();

    res.status(201).json({
      success: true,
      question: newQuestion.toObject(),
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create question',
    });
  }
};

/**
 * Update question
 * PUT /api/questions/:id
 */
export const updateQuestion = async (req, res) => {
  try {
    const {
      question,
      options,
      correctAnswer,
      explanation,
      subject,
      category,
      difficulty,
      tags,
      points,
      timeLimit,
    } = req.body;

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (options !== undefined) updateData.options = options;
    if (correctAnswer !== undefined) updateData.correctAnswer = correctAnswer;
    if (explanation !== undefined) updateData.explanation = explanation;
    if (subject !== undefined) updateData.subject = subject;
    if (category !== undefined) updateData.category = category;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (points !== undefined) updateData.points = points;
    if (timeLimit !== undefined) updateData.timeLimit = timeLimit;

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      question: updatedQuestion,
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update question',
    });
  }
};

/**
 * Delete question (soft delete)
 * DELETE /api/questions/:id
 */
export const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete question',
    });
  }
};

/**
 * Get random questions for quiz
 * GET /api/questions/random
 */
export const getRandomQuestions = async (req, res) => {
  try {
    const { count = 10, subject, category, difficulty } = req.query;

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

    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: parseInt(count) } },
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

    res.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error('Get random questions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch random questions',
    });
  }
};


