import Summary from '../models/Summary.js';
import Note from '../models/Note.js';
import Document from '../models/Document.js';
import { generateSummary, generateSummaryFromDocument } from '../utils/groq.js';
import { createNotification } from '../services/notification.service.js';
import path from 'path';
import fs from 'fs';

/**
 * Generate AI summary for a note
 * POST /api/summaries/generate
 */
export const generateSummaryForNote = async (req, res) => {
  const startTime = Date.now();

  try {
    const { noteId, summaryType, summaryLength, advancedOptions = {} } = req.body;

    // Validate required fields
    if (!noteId || !summaryType || !summaryLength) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: noteId, summaryType, and summaryLength are required',
      });
    }

    // Validate enum values
    const validTypes = ['key_points', 'structured', 'simplified', 'exam_focus'];
    const validLengths = ['brief', 'standard', 'detailed'];

    if (!validTypes.includes(summaryType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid summaryType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (!validLengths.includes(summaryLength)) {
      return res.status(400).json({
        success: false,
        error: `Invalid summaryLength. Must be one of: ${validLengths.join(', ')}`,
      });
    }

    // Fetch note from database
    const note = await Note.findOne({
      _id: noteId,
      userId: req.user._id,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or you do not have access to it',
      });
    }

    console.log(`🤖 Generating ${summaryType} summary (${summaryLength}) for note: ${note.title}`);

    // Generate summary using Groq API
    const result = await generateSummary(
      note.content,
      summaryType,
      summaryLength,
      advancedOptions
    );

    const summaryContent = result.summary;
    const tokensUsed = result.tokensUsed || 0;

    // Calculate word count
    const wordCount = summaryContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Summary generated in ${generationTime}s (${wordCount} words, ${tokensUsed} tokens)`);

    // Save summary to database
    const summary = new Summary({
      noteId: note._id,
      summaryType,
      summaryLength,
      content: summaryContent,
      wordCount,
      userId: req.user._id,
      advancedOptions: {
        includeExamples: advancedOptions.includeExamples || false,
        includeDiagrams: advancedOptions.includeDiagrams || false,
        focusAreas: advancedOptions.focusAreas || [],
        customInstructions: advancedOptions.customInstructions || '',
      },
    });

    await summary.save();

    // Populate note details for response
    await summary.populate('noteId', 'title subject');

    res.status(201).json({
      success: true,
      summary: {
        _id: summary._id,
        noteId: summary.noteId._id,
        noteTitle: summary.noteId.title,
        summaryType: summary.summaryType,
        summaryLength: summary.summaryLength,
        content: summary.content,
        wordCount: summary.wordCount,
        advancedOptions: summary.advancedOptions,
        generatedAt: summary.generatedAt,
      },
      model: 'llama-3.3-70b-versatile',
      tokensUsed: tokensUsed,
      generationTime: parseFloat(generationTime),
    });

    // Create notification for AI summary ready
    createNotification({
      userId: req.user._id,
      type: 'ai_summary_ready',
      metadata: { summaryId: summary._id.toString(), noteTitle: summary.noteId.title },
      relatedId: summary._id,
      relatedType: 'summary',
    }).catch((err) => {
      console.error('Failed to create notification:', err?.message || err);
    });
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Summary generation error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error name:', error.name);
    console.error('   Error stack:', error.stack?.substring(0, 500));
    if (error.cause) {
      console.error('   Error cause:', error.cause);
    }
    if (error.response) {
      console.error('   Error response:', error.response);
    }

    // Extract detailed error message
    let errorMessage = error.message || 'Failed to generate summary. Please try again.';
    let statusCode = 500;

    // Check quota/rate limit errors FIRST (before API key checks)
    if (error.message?.includes('rate limit') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      statusCode = 429;
      errorMessage = error.message || 'Groq API rate limit exceeded. Please try again later or upgrade your API plan.';

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'RATE_LIMIT_ERROR',
      });
    }

    // Handle API key errors - be more specific to avoid false positives
    if (error.message?.includes('API key') || error.message?.includes('not configured') || error.message?.includes('GROQ_API_KEY') || (error.message?.includes('Invalid') && error.message?.includes('API key'))) {
      statusCode = 500;
      errorMessage = error.message || 'AI service configuration error. Please check your Groq API key in the .env file. Get your API key from: https://console.groq.com/keys';

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: 'Make sure GROQ_API_KEY is set in your backend .env file',
        errorType: 'API_KEY_ERROR',
      });
    }

    if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND') || error.message?.includes('ETIMEDOUT')) {
      statusCode = 500;
      errorMessage = error.message || 'Network error connecting to Groq API. Please check your internet connection.';

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'NETWORK_ERROR',
      });
    }

    // For server errors (500/503), include the detailed message
    if (error.message?.includes('server error') || error.message?.includes('500') || error.message?.includes('503') || error.message?.includes('UNAVAILABLE')) {
      statusCode = 500;
      errorMessage = error.message || 'Groq API server error. Please try again later.';

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'SERVER_ERROR',
      });
    }

    // Return the actual error message with details for better debugging
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      errorType: 'UNKNOWN_ERROR',
    });
  }
};

/**
 * Get all summaries for a specific note
 * GET /api/summaries/note/:noteId
 */
export const getSummariesByNote = async (req, res) => {
  try {
    const { noteId } = req.params;

    // Verify note belongs to user
    const note = await Note.findOne({
      _id: noteId,
      userId: req.user._id,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or you do not have access to it',
      });
    }

    // Fetch all summaries for this note
    const summaries = await Summary.find({
      noteId: noteId,
      userId: req.user._id,
    })
      .sort({ generatedAt: -1 })
      .select('-userId'); // Exclude userId from response

    res.json({
      success: true,
      count: summaries.length,
      summaries: summaries.map((s) => ({
        _id: s._id,
        noteId: s.noteId,
        summaryType: s.summaryType,
        summaryLength: s.summaryLength,
        content: s.content,
        wordCount: s.wordCount,
        advancedOptions: s.advancedOptions,
        generatedAt: s.generatedAt,
      })),
    });
  } catch (error) {
    console.error('Get summaries error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch summaries',
    });
  }
};

/**
 * Get single summary by ID
 * GET /api/summaries/:id
 */
export const getSummaryById = async (req, res) => {
  try {
    const { id } = req.params;

    const summary = await Summary.findOne({
      _id: id,
      userId: req.user._id,
    }).populate('noteId', 'title subject');

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found or you do not have access to it',
      });
    }

    res.json({
      success: true,
      summary: {
        _id: summary._id,
        noteId: summary.noteId._id,
        noteTitle: summary.noteId.title,
        noteSubject: summary.noteId.subject,
        summaryType: summary.summaryType,
        summaryLength: summary.summaryLength,
        content: summary.content,
        wordCount: summary.wordCount,
        advancedOptions: summary.advancedOptions,
        generatedAt: summary.generatedAt,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch summary',
    });
  }
};

/**
 * Delete a summary
 * DELETE /api/summaries/:id
 */
export const deleteSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const summary = await Summary.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found or you do not have access to it',
      });
    }

    res.json({
      success: true,
      message: 'Summary deleted successfully',
    });
  } catch (error) {
    console.error('Delete summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete summary',
    });
  }
};

/**
 * Generate AI summary from text content directly
 * POST /api/summaries/generate-from-text
 */
export const generateSummaryFromText = async (req, res) => {
  const startTime = Date.now();

  try {
    const { noteText, summaryType, summaryLength, advancedOptions = {}, documentTitle, documentId } = req.body;

    // Validate required fields
    if (!noteText || !summaryType || !summaryLength) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: noteText, summaryType, and summaryLength are required',
      });
    }

    // documentId is required to link the summary to the source document
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: documentId is required to link the summary to the source document',
      });
    }

    // Validate enum values
    const validTypes = ['key_points', 'structured', 'simplified', 'exam_focus'];
    const validLengths = ['brief', 'standard', 'detailed'];

    if (!validTypes.includes(summaryType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid summaryType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (!validLengths.includes(summaryLength)) {
      return res.status(400).json({
        success: false,
        error: `Invalid summaryLength. Must be one of: ${validLengths.join(', ')}`,
      });
    }

    if (!noteText.trim() || noteText.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Text content is too short. Please provide at least 10 characters of text.',
      });
    }

    console.log(`🤖 Generating ${summaryType} summary (${summaryLength}) from text content`);
    console.log(`   Text length: ${noteText.length} characters`);

    // Generate summary using Groq API
    const result = await generateSummary(
      noteText,
      summaryType,
      summaryLength,
      advancedOptions
    );

    const summaryContent = result.summary;
    const tokensUsed = result.tokensUsed || 0;

    // Calculate word count
    const wordCount = summaryContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Summary generated in ${generationTime}s (${wordCount} words, ${tokensUsed} tokens)`);

    // Save summary to database
    // Use documentId as noteId (for compatibility with document summaries)
    // This links the summary to the source document
    const summary = new Summary({
      noteId: documentId, // Use documentId as noteId to link summary to the document
      summaryType,
      summaryLength,
      content: summaryContent,
      wordCount,
      userId: req.user._id,
      advancedOptions: {
        includeExamples: advancedOptions.includeExamples || false,
        includeDiagrams: advancedOptions.includeDiagrams || false,
        focusAreas: advancedOptions.focusAreas || [],
        customInstructions: advancedOptions.customInstructions || '',
      },
    });

    await summary.save();

    res.status(201).json({
      success: true,
      summary: {
        _id: summary._id,
        documentTitle: documentTitle || 'Text Content',
        summaryType: summary.summaryType,
        summaryLength: summary.summaryLength,
        content: summary.content,
        wordCount: summary.wordCount,
        advancedOptions: summary.advancedOptions,
        generatedAt: summary.generatedAt,
      },
      model: 'llama-3.3-70b-versatile',
      tokensUsed: tokensUsed,
      generationTime: parseFloat(generationTime),
    });
  } catch (error) {
    console.error('❌ Text summary generation error:', error);
    console.error('   Error message:', error?.message);
    console.error('   Error name:', error?.name);

    let errorMessage = 'Failed to generate summary. Please try again.';
    let statusCode = 500;

    if (error.message) {
      errorMessage = error.message;
    }

    // Handle API key errors
    if (errorMessage.includes('API key') || errorMessage.includes('not configured') || errorMessage.includes('GROQ_API_KEY')) {
      statusCode = 500;
      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: 'Make sure GROQ_API_KEY is set in your backend .env file',
        errorType: 'API_KEY_ERROR',
      });
    }

    // Handle rate limit errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      statusCode = 429;
      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'RATE_LIMIT_ERROR',
      });
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      errorType: 'UNKNOWN_ERROR',
    });
  }
};

/**
 * Generate AI summary for a document (supports images and PDFs)
 * POST /api/summaries/generate-document
 */
export const generateSummaryForDocument = async (req, res) => {
  const startTime = Date.now();

  try {
    const { documentId, summaryType, summaryLength, advancedOptions = {} } = req.body;

    // Validate required fields
    if (!documentId || !summaryType || !summaryLength) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: documentId, summaryType, and summaryLength are required',
      });
    }

    // Validate enum values
    const validTypes = ['key_points', 'structured', 'simplified', 'exam_focus'];
    const validLengths = ['brief', 'standard', 'detailed'];

    if (!validTypes.includes(summaryType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid summaryType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (!validLengths.includes(summaryLength)) {
      return res.status(400).json({
        success: false,
        error: `Invalid summaryLength. Must be one of: ${validLengths.join(', ')}`,
      });
    }

    // Fetch document from database
    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or you do not have access to it',
      });
    }

    // Construct absolute path to file
    const absolutePath = path.join(process.cwd(), 'uploads', document.filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        error: 'Document file not found on server',
      });
    }

    console.log(`🤖 Generating ${summaryType} summary (${summaryLength}) for document: ${document.title}`);
    console.log(`   File type: ${document.fileType}`);
    console.log(`   File path: ${absolutePath}`);

    // Generate summary from document (handles PDFs, text files)
    // Note: Groq API doesn't support image analysis directly
    const result = await generateSummaryFromDocument(
      absolutePath,
      document.fileType,
      summaryType,
      summaryLength,
      advancedOptions
    );

    const summaryContent = result.summary;
    const tokensUsed = result.tokensUsed || 0;

    // Calculate word count
    const wordCount = summaryContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Summary generated in ${generationTime}s (${wordCount} words, ${tokensUsed} tokens)`);

    // Save summary to database (link to document via noteId field for compatibility)
    const summary = new Summary({
      noteId: document._id, // Using noteId field to store documentId for compatibility
      summaryType,
      summaryLength,
      content: summaryContent,
      wordCount,
      userId: req.user._id,
      advancedOptions: {
        includeExamples: advancedOptions.includeExamples || false,
        includeDiagrams: advancedOptions.includeDiagrams || false,
        focusAreas: advancedOptions.focusAreas || [],
        customInstructions: advancedOptions.customInstructions || '',
      },
    });

    await summary.save();

    res.status(201).json({
      success: true,
      summary: {
        _id: summary._id,
        documentId: document._id,
        documentTitle: document.title,
        summaryType: summary.summaryType,
        summaryLength: summary.summaryLength,
        content: summary.content,
        wordCount: summary.wordCount,
        advancedOptions: summary.advancedOptions,
        generatedAt: summary.generatedAt,
      },
      model: 'llama-3.3-70b-versatile',
      tokensUsed: tokensUsed,
      generationTime: parseFloat(generationTime),
    });
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Document summary generation error:', error);
    console.error('   Error type:', typeof error);
    console.error('   Error message:', error?.message);
    console.error('   Error name:', error?.name);
    console.error('   Error stack:', error?.stack?.substring(0, 500));
    if (error?.cause) {
      console.error('   Error cause:', error.cause);
    }
    if (error?.response) {
      console.error('   Error response:', error.response);
    }

    // Extract detailed error message - handle cases where error might be undefined or not an Error object
    let errorMessage = 'Failed to generate summary. Please try again.';
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.toString) {
        errorMessage = error.toString();
      }
    }
    let statusCode = 500;

    // Check quota/rate limit errors FIRST (before API key checks)
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      statusCode = 429;
      if (!errorMessage.includes('rate limit') && !errorMessage.includes('quota')) {
        errorMessage = 'Groq API rate limit exceeded. Please try again later or upgrade your API plan.';
      }

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'RATE_LIMIT_ERROR',
      });
    }

    // Handle API key errors - be more specific to avoid false positives
    if (errorMessage.includes('API key') || errorMessage.includes('not configured') || errorMessage.includes('GROQ_API_KEY') || (errorMessage.includes('Invalid') && errorMessage.includes('API key'))) {
      statusCode = 500;
      if (!errorMessage.includes('API key') && !errorMessage.includes('GROQ_API_KEY')) {
        errorMessage = 'AI service configuration error. Please check your Groq API key in the .env file. Get your API key from: https://console.groq.com/keys';
      }

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: 'Make sure GROQ_API_KEY is set in your backend .env file',
        errorType: 'API_KEY_ERROR',
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ETIMEDOUT')) {
      statusCode = 500;
      if (!errorMessage.includes('network') && !errorMessage.includes('connection')) {
        errorMessage = 'Network error connecting to Groq API. Please check your internet connection.';
      }

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'NETWORK_ERROR',
      });
    }

    // For server errors (500/503), include the detailed message
    if (errorMessage.includes('server error') || errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE')) {
      statusCode = 500;
      // Use the error message as-is since it now contains detailed information
      if (!errorMessage.includes('server error') && !errorMessage.includes('500') && !errorMessage.includes('503')) {
        errorMessage = 'Groq API server error. Please try again later.';
      }

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorType: 'SERVER_ERROR',
      });
    }

    // Return the actual error message with details for better debugging
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      errorType: 'UNKNOWN_ERROR',
    });
  }
};

