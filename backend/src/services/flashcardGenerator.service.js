import Flashcard from '../models/Flashcard.js';
import Document from '../models/Document.js';
import { loadDocumentContent } from '../utils/documentContent.js';
import { generateFlashcardsFromContent } from '../utils/groq.js';
import { createNotification } from './notification.service.js';

const MIN_FLASHCARDS = 1;

export async function generateFlashcardsForDocument(documentId, options = {}) {
  const doc = await Document.findById(documentId);
  if (!doc) {
    throw new Error('Document not found');
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  doc.autoFlashcardsStatus = 'processing';
  doc.autoFlashcardsError = null;
  await doc.save();

  try {
    const content = await loadDocumentContent(doc);
    const flashcards = await generateFlashcardsFromContent(content, {
      maxCards: options.maxCards || 6,
      subject: doc.category || doc.tags?.[0] || 'General Studies',
      documentTitle: doc.title,
      documentTags: doc.tags || [],
      isImageSource: doc.fileType?.startsWith('image/'),
    });

    if (!flashcards.length) {
      throw new Error('No flashcards were generated from this document');
    }

    const createdFlashcards = [];
    let duplicateCount = 0;
    for (const card of flashcards) {
      const existing = await Flashcard.findOne({
        userId: doc.userId,
        sourceDocumentId: doc._id,
        question: card.question,
      });
      if (existing) {
        duplicateCount += 1;
        continue;
      }

      const flashcard = new Flashcard({
        userId: doc.userId,
        question: card.question,
        answer: card.answer,
        hint: card.hint || '',
        subject: card.subject || doc.category || 'General',
        category: doc.category || 'General',
        tags: card.tags?.length ? card.tags : doc.tags || [],
        difficulty: card.difficulty || 'medium',
        examples: card.examples || [],
        sourceType: 'document',
        sourceDocumentId: doc._id,
        sourceTitle: doc.title,
      });
      await flashcard.save();
      createdFlashcards.push(flashcard);
    }

    if (createdFlashcards.length < MIN_FLASHCARDS) {
      doc.autoFlashcardsStatus = 'completed';
      doc.autoFlashcardsCount = 0;
      doc.autoFlashcardsLastGeneratedAt = new Date();
      await doc.save();

      return {
        createdFlashcards: [],
        duplicateCount,
        totalGenerated: flashcards.length,
      };
    }

    doc.autoFlashcardsStatus = 'completed';
    doc.autoFlashcardsCount = createdFlashcards.length;
    doc.autoFlashcardsLastGeneratedAt = new Date();
    await doc.save();

    // Create notification for flashcards created
    createNotification({
      userId: doc.userId,
      type: 'flashcards_created',
      metadata: {
        documentId: doc._id.toString(),
        documentTitle: doc.title,
        count: createdFlashcards.length
      },
      relatedId: doc._id,
      relatedType: 'document',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    return {
      createdFlashcards,
      duplicateCount,
      totalGenerated: flashcards.length,
    };
  } catch (error) {
    doc.autoFlashcardsStatus = 'failed';
    doc.autoFlashcardsError = error.message;
    await doc.save();

    // Create notification for document process failure
    createNotification({
      userId: doc.userId,
      type: 'document_process_failed',
      metadata: {
        documentId: doc._id.toString(),
        documentTitle: doc.title,
        error: error.message
      },
      relatedId: doc._id,
      relatedType: 'document',
      priority: 'high',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });

    throw error;
  }
}

export async function queueFlashcardGeneration(documentId, options) {
  const doc = await Document.findById(documentId);
  if (!doc) {
    return;
  }

  // If Groq isn't configured, mark as failed gracefully and exit
  if (!process.env.GROQ_API_KEY) {
    doc.autoFlashcardsStatus = 'failed';
    doc.autoFlashcardsError = 'GROQ_API_KEY is not configured';
    await doc.save();
    return;
  }

  doc.autoFlashcardsStatus = 'queued';
  doc.autoFlashcardsError = null;
  await doc.save();

  // Run in background without blocking upload response
  setImmediate(async () => {
    try {
      await generateFlashcardsForDocument(documentId, options);
    } catch (err) {
      console.error('Auto flashcard generation failed:', err?.message || err);
    }
  });
}

