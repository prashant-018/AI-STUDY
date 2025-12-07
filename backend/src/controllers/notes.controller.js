import Note from '../models/Note.js';
import Summary from '../models/Summary.js';
import QuizResult from '../models/QuizResult.js';
import Question from '../models/Question.js';
import { createActivity } from './activityController.js';

/**
 * Get all notes for the authenticated user
 * GET /api/notes?subject=Biology&difficulty=medium
 */
export const listNotes = async (req, res) => {
  try {
    const { subject, difficulty, search } = req.query;

    // Build query
    const query = { userId: req.user._id };

    if (subject) {
      query.subject = new RegExp(subject, 'i'); // Case-insensitive search
    }

    if (difficulty && ['easy', 'medium', 'advanced'].includes(difficulty)) {
      query.difficulty = difficulty;
    }

    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { content: new RegExp(search, 'i') },
        { subject: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const notes = await Note.find(query)
      .select('-__v')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (err) {
    console.error('List notes error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch notes'
    });
  }
};

/**
 * Get single note by ID
 * GET /api/notes/:id
 */
export const getNote = async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('-__v');

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.json({
      success: true,
      note,
    });
  } catch (err) {
    console.error('Get note error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch note'
    });
  }
};

/**
 * Create new note
 * POST /api/notes
 * Body: { title, content, subject?, difficulty?, tags? }
 */
export const createNote = async (req, res) => {
  try {
    const { title, content = '', subject, difficulty, tags = [] } = req.body || {};

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'title is required and cannot be empty'
      });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        success: false,
        error: 'content is required'
      });
    }

    // Validate title length
    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        error: 'title must be less than 200 characters',
      });
    }

    // Validate difficulty if provided
    if (difficulty && !['easy', 'medium', 'advanced'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: 'difficulty must be one of: easy, medium, advanced',
      });
    }

    // Validate tags
    if (tags && !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        error: 'tags must be an array',
      });
    }

    // Clean and validate tags
    const cleanTags = Array.isArray(tags)
      ? tags.filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase())
        .slice(0, 10) // Limit to 10 tags
      : [];

    const noteData = {
      userId: req.user._id,
      user: req.user._id, // For backward compatibility
      title: title.trim(),
      content: typeof content === 'string' ? content : String(content),
      subject: subject ? subject.trim() : undefined,
      difficulty: difficulty || 'medium',
      tags: cleanTags,
    };

    const note = await Note.create(noteData);

    // Create activity record
    await createActivity(req.user._id, 'note', {
      subject: note.subject || 'General',
      topic: note.title,
      details: {},
    }).catch(err => {
      console.error('Failed to create activity for note:', err);
    });

    // Remove __v from response
    const noteResponse = note.toObject();
    delete noteResponse.__v;

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note: noteResponse,
    });
  } catch (err) {
    console.error('Create note error:', err);

    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'A note with this title already exists',
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(err.errors).map(e => e.message).join(', '),
      });
    }

    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to create note'
    });
  }
};

/**
 * Update existing note
 * PUT /api/notes/:id
 * Body: { title?, content?, subject?, difficulty?, tags? }
 */
export const updateNote = async (req, res) => {
  try {
    const { title, content, subject, difficulty, tags } = req.body || {};
    const noteId = req.params.id;

    // Validate ObjectId format
    if (!noteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid note ID format',
      });
    }

    // Validate title if provided
    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'title cannot be empty',
        });
      }
      if (title.trim().length > 200) {
        return res.status(400).json({
          success: false,
          error: 'title must be less than 200 characters',
        });
      }
    }

    // Validate difficulty if provided
    if (difficulty && !['easy', 'medium', 'advanced'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: 'difficulty must be one of: easy, medium, advanced',
      });
    }

    // Validate tags if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        error: 'tags must be an array',
      });
    }

    // Build update object
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = typeof content === 'string' ? content : String(content);
    if (subject !== undefined) updateData.subject = subject ? subject.trim() : null;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (tags !== undefined) {
      // Clean and validate tags
      updateData.tags = Array.isArray(tags)
        ? tags.filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
          .map(tag => tag.trim().toLowerCase())
          .slice(0, 10) // Limit to 10 tags
        : [];
    }

    const updated = await Note.findOneAndUpdate(
      { _id: noteId, userId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.json({
      success: true,
      message: 'Note updated successfully',
      note: updated,
    });
  } catch (err) {
    console.error('Update note error:', err);

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(err.errors).map(e => e.message).join(', '),
      });
    }

    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to update note'
    });
  }
};

/**
 * Delete note and all its summaries
 * DELETE /api/notes/:id
 */
export const deleteNote = async (req, res) => {
  try {
    const noteId = req.params.id;

    // Validate ObjectId format
    if (!noteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid note ID format',
      });
    }

    // Verify note belongs to user
    const note = await Note.findOne({
      _id: noteId,
      userId: req.user._id
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Delete all summaries associated with this note
    const deletedSummaries = await Summary.deleteMany({ noteId: noteId, userId: req.user._id });

    // Delete the note
    await Note.findByIdAndDelete(noteId);

    res.json({
      success: true,
      message: 'Note and all associated summaries deleted successfully',
      deletedSummariesCount: deletedSummaries.deletedCount || 0,
    });
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete note'
    });
  }
};

/**
 * Get notes statistics for the authenticated user
 * GET /api/notes/stats
 */
export const getNotesStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get total count
    const totalNotes = await Note.countDocuments({ userId });

    // Get counts by difficulty
    const difficultyStats = await Note.aggregate([
      { $match: { userId } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]);

    // Get counts by subject
    const subjectStats = await Note.aggregate([
      { $match: { userId, subject: { $exists: true, $ne: null } } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get total word count
    const wordCountStats = await Note.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalWords: { $sum: '$wordCount' },
          avgWords: { $avg: '$wordCount' },
        }
      },
    ]);

    // Get recent notes count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentNotes = await Note.countDocuments({
      userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      stats: {
        total: totalNotes,
        recent: recentNotes,
        difficulty: difficultyStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topSubjects: subjectStats.map(item => ({
          subject: item._id,
          count: item.count,
        })),
        wordCount: {
          total: wordCountStats[0]?.totalWords || 0,
          average: Math.round(wordCountStats[0]?.avgWords || 0),
        },
      },
    });
  } catch (err) {
    console.error('Get notes stats error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch notes statistics',
    });
  }
};

/**
 * Bulk delete notes
 * DELETE /api/notes/bulk
 * Body: { noteIds: [id1, id2, ...] }
 */
export const bulkDeleteNotes = async (req, res) => {
  try {
    const { noteIds } = req.body || {};

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'noteIds must be a non-empty array',
      });
    }

    // Validate all IDs are valid ObjectIds
    const validIds = noteIds.filter(id => id && id.match(/^[0-9a-fA-F]{24}$/));

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid note IDs provided',
      });
    }

    // Delete notes that belong to the user
    const result = await Note.deleteMany({
      _id: { $in: validIds },
      userId: req.user._id,
    });

    // Delete associated summaries
    await Summary.deleteMany({
      noteId: { $in: validIds },
      userId: req.user._id,
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} note(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error('Bulk delete notes error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete notes',
    });
  }
};

/**
 * Create notes from quiz results
 * POST /api/notes/from-quiz
 * Body: { quizResultId, includeCorrect?: boolean, includeIncorrect?: boolean }
 * 
 * Creates notes from quiz questions, focusing on incorrect answers and explanations
 */
export const createNotesFromQuiz = async (req, res) => {
  try {
    const { quizResultId, includeCorrect = false, includeIncorrect = true } = req.body || {};

    if (!quizResultId) {
      return res.status(400).json({
        success: false,
        error: 'quizResultId is required',
      });
    }

    // Validate quizResultId format
    if (!quizResultId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quizResultId format',
      });
    }

    // Get quiz result
    const quizResult = await QuizResult.findOne({
      _id: quizResultId,
      userId: req.user._id,
      isCompleted: true,
    }).populate('questions.questionId');

    if (!quizResult) {
      return res.status(404).json({
        success: false,
        error: 'Quiz result not found or not completed',
      });
    }

    // Filter questions based on options
    let questionsToProcess = [];

    if (includeIncorrect) {
      const incorrectQuestions = quizResult.questions.filter(q => !q.isCorrect);
      questionsToProcess.push(...incorrectQuestions);
    }

    if (includeCorrect) {
      const correctQuestions = quizResult.questions.filter(q => q.isCorrect);
      questionsToProcess.push(...correctQuestions);
    }

    if (questionsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No questions found matching the criteria',
      });
    }

    // Group questions by subject/category for better note organization
    const questionsBySubject = {};

    for (const qData of questionsToProcess) {
      const question = qData.questionId;
      if (!question) continue;

      const subject = quizResult.subject || question.subject || 'General';
      const category = quizResult.category || question.category || 'General';
      const key = `${subject}_${category}`;

      if (!questionsBySubject[key]) {
        questionsBySubject[key] = {
          subject,
          category,
          questions: [],
        };
      }

      questionsBySubject[key].questions.push({
        question: question.question || qData.question,
        options: question.options || [],
        userAnswer: qData.userAnswer,
        correctAnswer: question.correctAnswer || qData.correctAnswer,
        explanation: question.explanation || '',
        isCorrect: qData.isCorrect,
        difficulty: question.difficulty || 'medium',
      });
    }

    // Create notes for each subject/category group
    const createdNotes = [];

    for (const [key, group] of Object.entries(questionsBySubject)) {
      // Build note content
      let noteContent = `# Quiz Review: ${group.subject} - ${group.category}\n\n`;
      noteContent += `**Quiz Mode:** ${quizResult.quizMode}\n`;
      noteContent += `**Date:** ${new Date(quizResult.completedAt).toLocaleDateString()}\n`;
      noteContent += `**Score:** ${quizResult.score}%\n\n`;
      noteContent += `---\n\n`;

      // Add questions
      group.questions.forEach((q, index) => {
        noteContent += `## Question ${index + 1}\n\n`;
        noteContent += `**${q.question}**\n\n`;

        // Add options
        if (q.options && q.options.length > 0) {
          noteContent += `**Options:**\n`;
          q.options.forEach((opt, optIndex) => {
            const isUserAnswer = optIndex === q.userAnswer;
            const isCorrect = optIndex === q.correctAnswer;
            let marker = '';

            if (isCorrect) marker = '✅ **CORRECT**';
            else if (isUserAnswer && !isCorrect) marker = '❌ **Your Answer (Wrong)**';
            else if (isUserAnswer) marker = '✓ Your Answer';

            noteContent += `${String.fromCharCode(65 + optIndex)}. ${opt} ${marker}\n`;
          });
          noteContent += `\n`;
        }

        // Add explanation if available
        if (q.explanation && q.explanation.trim().length > 0) {
          noteContent += `**Explanation:**\n${q.explanation}\n\n`;
        }

        // Add learning point
        if (!q.isCorrect) {
          noteContent += `⚠️ **Review Needed:** This question was answered incorrectly. Study the explanation above.\n\n`;
        }

        noteContent += `---\n\n`;
      });

      // Determine difficulty based on questions
      const difficulties = group.questions.map(q => q.difficulty);
      const mostCommonDifficulty = difficulties.reduce((a, b, _, arr) =>
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        , 'medium');

      // Map quiz difficulty to note difficulty
      const difficultyMap = {
        'easy': 'easy',
        'medium': 'medium',
        'hard': 'advanced',
        'mixed': mostCommonDifficulty === 'hard' ? 'advanced' : mostCommonDifficulty,
      };

      const noteDifficulty = difficultyMap[quizResult.difficulty] || 'medium';

      // Create note
      const noteData = {
        userId: req.user._id,
        user: req.user._id,
        title: `Quiz Review: ${group.subject} - ${group.category}`,
        content: noteContent,
        subject: group.subject,
        difficulty: noteDifficulty,
        tags: [
          'quiz-review',
          quizResult.quizMode,
          group.subject.toLowerCase(),
          group.category.toLowerCase(),
        ],
      };

      const note = await Note.create(noteData);
      const noteResponse = note.toObject();
      delete noteResponse.__v;

      createdNotes.push(noteResponse);
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdNotes.length} note(s) from quiz results`,
      notes: createdNotes,
      quizResult: {
        id: quizResult._id,
        score: quizResult.score,
        mode: quizResult.quizMode,
        subject: quizResult.subject,
      },
    });
  } catch (err) {
    console.error('Create notes from quiz error:', err);

    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(err.errors).map(e => e.message).join(', '),
      });
    }

    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to create notes from quiz',
    });
  }
};



