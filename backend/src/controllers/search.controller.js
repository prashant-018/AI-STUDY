import Note from '../models/Note.js';
import Document from '../models/Document.js';
import Flashcard from '../models/Flashcard.js';
import QuizResult from '../models/QuizResult.js';
import logger from '../utils/logger.js';

/**
 * Unified search across all content types
 * GET /api/search?q=searchterm
 */
export const unifiedSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user._id;

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        results: {
          notes: [],
          documents: [],
          flashcards: [],
          quizzes: [],
        },
        total: 0,
      });
    }

    const searchRegex = new RegExp(String(q).trim(), 'i');

    // Search in parallel
    const [notes, documents, flashcards, quizzes] = await Promise.all([
      // Search notes
      Note.find({
        userId,
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { subject: searchRegex },
          { tags: { $in: [searchRegex] } },
        ],
      })
        .select('_id title subject createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),

      // Search documents
      Document.find({
        userId,
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { tags: searchRegex },
        ],
      })
        .select('_id title category uploadedAt fileType')
        .sort({ uploadedAt: -1 })
        .limit(10)
        .lean(),

      // Search flashcards
      Flashcard.find({
        userId,
        $or: [
          { question: searchRegex },
          { answer: searchRegex },
          { subject: searchRegex },
          { tags: { $in: [searchRegex] } },
        ],
      })
        .select('_id question answer subject createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Search quiz results
      QuizResult.find({
        userId,
        isCompleted: true,
        $or: [
          { subject: searchRegex },
          { category: searchRegex },
        ],
      })
        .select('_id subject category score completedAt')
        .sort({ completedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // Format results
    const formattedNotes = notes.map(note => ({
      id: note._id,
      type: 'note',
      title: note.title,
      subtitle: note.subject || 'General',
      date: note.updatedAt || note.createdAt,
    }));

    const formattedDocuments = documents.map(doc => ({
      id: doc._id,
      type: 'document',
      title: doc.title,
      subtitle: doc.category || 'Document',
      date: doc.uploadedAt,
      fileType: doc.fileType,
    }));

    const formattedFlashcards = flashcards.map(card => ({
      id: card._id,
      type: 'flashcard',
      title: card.question?.substring(0, 50) || 'Flashcard',
      subtitle: card.subject || 'General',
      date: card.createdAt,
    }));

    const formattedQuizzes = quizzes.map(quiz => ({
      id: quiz._id,
      type: 'quiz',
      title: `${quiz.subject || 'General'} Quiz`,
      subtitle: `Score: ${quiz.score || 0}%`,
      date: quiz.completedAt,
    }));

    const allResults = [
      ...formattedNotes,
      ...formattedDocuments,
      ...formattedFlashcards,
      ...formattedQuizzes,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    logger.info(`Search performed for user ${userId}: "${q}" - ${allResults.length} results`);

    res.json({
      success: true,
      query: q,
      results: {
        notes: formattedNotes,
        documents: formattedDocuments,
        flashcards: formattedFlashcards,
        quizzes: formattedQuizzes,
        all: allResults,
      },
      total: allResults.length,
    });
  } catch (error) {
    logger.error('Unified search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed',
    });
  }
};

