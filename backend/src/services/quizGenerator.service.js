import Question from '../models/Question.js';
import Document from '../models/Document.js';
import { loadDocumentContent } from '../utils/documentContent.js';
import { generateQuestionsFromContent } from '../utils/groq.js';
import { createNotification } from './notification.service.js';

const MIN_QUESTIONS = 1;

/**
 * Generate quiz questions from a document
 * @param {string} documentId - Document ID
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated questions info
 */
export async function generateQuestionsForDocument(documentId, options = {}) {
  const doc = await Document.findById(documentId);
  if (!doc) {
    throw new Error('Document not found');
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  try {
    const content = await loadDocumentContent(doc);
    const questions = await generateQuestionsFromContent(content, {
      maxQuestions: options.maxQuestions || 6,
      subject: doc.category || doc.tags?.[0] || 'General Studies',
      documentTitle: doc.title,
      documentTags: doc.tags || [],
      isImageSource: doc.fileType?.startsWith('image/'),
    });

    if (!questions.length) {
      throw new Error('No questions were generated from this document');
    }

    const createdQuestions = [];
    let duplicateCount = 0;

    for (const q of questions) {
      const existing = await Question.findOne({
        userId: doc.userId,
        question: q.question,
        subject: q.subject,
      });

      if (existing) {
        duplicateCount += 1;
        continue;
      }

      const question = new Question({
        userId: doc.userId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject,
        category: q.category,
        difficulty: q.difficulty,
        tags: q.tags?.length ? q.tags : doc.tags || [],
        points: q.points || 10,
        timeLimit: q.timeLimit || 60,
        isActive: true,
      });

      await question.save();
      createdQuestions.push(question);
    }

    if (createdQuestions.length < MIN_QUESTIONS) {
      return {
        createdQuestions: [],
        duplicateCount,
        totalGenerated: questions.length,
      };
    }

    // Create notification for questions created
    createNotification({
      userId: doc.userId,
      type: 'quiz_questions_created',
      metadata: {
        documentId: doc._id.toString(),
        documentTitle: doc.title,
        count: createdQuestions.length
      },
      relatedId: doc._id,
      relatedType: 'document',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    return {
      createdQuestions,
      duplicateCount,
      totalGenerated: questions.length,
    };
  } catch (error) {
    console.error('Question generation error:', error);
    throw error;
  }
}

