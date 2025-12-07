/**
 * Groq API Integration for AI Summary Generation
 * Uses Groq's OpenAI-compatible API endpoint
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Updated from deprecated llama-3.1-70b-versatile
// Alternative faster model: 'llama-3.1-8b-instant' (faster, still good quality)

/**
 * Get and validate Groq API key from environment variables
 * @returns {string} Validated API key
 * @throws {Error} If API key is missing or invalid
 */
function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    const errorMsg = 'GROQ_API_KEY is not configured. Please set GROQ_API_KEY in your .env file. Get your API key from: https://console.groq.com/keys';
    console.error('❌', errorMsg);
    console.error('   Current working directory:', process.cwd());
    console.error('   Check if .env file exists in:', process.cwd() + '/.env');
    throw new Error(errorMsg);
  }

  // Remove quotes if present (common mistake in .env files)
  let trimmedKey = apiKey.trim();
  if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
    (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
    console.warn('⚠️  API key has quotes - removing them');
    trimmedKey = trimmedKey.slice(1, -1).trim();
  }

  return trimmedKey;
}

/**
 * Generate AI summary using Groq API
 * @param {string} noteContent - The note content to summarize
 * @param {string} summaryType - Type of summary: 'key_points', 'structured', 'simplified', 'exam_focus'
 * @param {string} summaryLength - Length: 'brief', 'standard', 'detailed'
 * @param {Object} advancedOptions - Additional options for customization
 * @returns {Promise<{summary: string, tokensUsed: number}>} Generated summary and token usage
 */
export async function generateSummary(noteContent, summaryType, summaryLength, advancedOptions = {}) {
  // Validate API key first
  const apiKey = getGroqApiKey();

  // Token limits based on summary length
  const tokenLimits = {
    brief: 150,
    standard: 300,
    detailed: 500,
  };

  const maxTokens = tokenLimits[summaryLength] || tokenLimits.standard;

  // Build system prompt based on summaryType
  let systemPrompt = 'You are a helpful assistant that creates clear, concise summaries of educational notes.';

  switch (summaryType) {
    case 'key_points':
      systemPrompt += '\n\nCreate a bullet-point summary highlighting the key concepts, main ideas, and important facts. Use clear, concise bullet points. Format:\n- Key point 1\n- Key point 2\n- Key point 3';
      break;
    case 'structured':
      systemPrompt += '\n\nOrganize the content by topics with clear headings and subheadings. Use a hierarchical structure for better readability. Include:\n- Main topics as headings\n- Subtopics as subheadings\n- Key information under each section';
      break;
    case 'simplified':
      systemPrompt += '\n\nSimplify the content for easy understanding. Use simple language, avoid jargon when possible, and use analogies if helpful. Make it accessible for quick comprehension.';
      break;
    case 'exam_focus':
      systemPrompt += '\n\nFocus on exam-relevant concepts, formulas, definitions, and important facts. Highlight what is most likely to be tested. Include:\n- Key definitions\n- Important formulas\n- Critical concepts\n- Common exam topics';
      break;
    default:
      systemPrompt += '\n\nCreate a comprehensive summary covering all important aspects.';
  }

  // Add length instructions
  const lengthGuide = {
    brief: `Keep it very concise, approximately ${maxTokens} tokens. Focus on the most essential points.`,
    standard: `Provide a balanced summary of approximately ${maxTokens} tokens with good coverage of main topics.`,
    detailed: `Create a comprehensive summary of approximately ${maxTokens} tokens with thorough coverage and depth.`,
  };

  systemPrompt += `\n\nLength requirement: ${lengthGuide[summaryLength] || lengthGuide.standard}`;

  // Add advanced options to prompt
  if (advancedOptions?.includeExamples) {
    systemPrompt += '\n\nInclude practical examples for each concept to enhance understanding.';
  }

  if (advancedOptions?.includeDiagrams) {
    systemPrompt += '\n\nNote: Include descriptions of diagrams or visual aids that would help explain the concepts.';
  }

  if (advancedOptions?.focusAreas && advancedOptions.focusAreas.length > 0) {
    systemPrompt += `\n\nFocus especially on these areas: ${advancedOptions.focusAreas.join(', ')}.`;
  }

  if (advancedOptions?.customInstructions && advancedOptions.customInstructions.trim()) {
    systemPrompt += `\n\nAdditional instructions: ${advancedOptions.customInstructions}`;
  }

  systemPrompt += '\n\nEnsure the summary is accurate, well-organized, and maintains the educational value of the original content.';

  try {
    console.log('🤖 Connecting to Groq API...');
    console.log(`   Model: ${GROQ_MODEL}`);
    console.log(`   Summary Type: ${summaryType}, Length: ${summaryLength}`);
    console.log(`   Max Tokens: ${maxTokens}`);

    const requestBody = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Summarize this educational note:\n\n${noteContent}`,
        },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
    };

    console.log('📤 Sending request to Groq API...');

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.statusText || 'Unknown error';
      const statusCode = response.status;

      console.error('❌ Groq API Error Response:', {
        status: statusCode,
        statusText,
        error: errorData,
      });

      // Handle specific error cases
      if (statusCode === 401 || statusCode === 403) {
        throw new Error('Invalid or unauthorized Groq API key. Please verify your API key is correct and has proper permissions. Get your API key from: https://console.groq.com/keys');
      }

      if (statusCode === 429) {
        throw new Error('Groq API rate limit exceeded. Please try again later or upgrade your API plan.');
      }

      if (statusCode === 500 || statusCode === 503) {
        throw new Error(`Groq API server error (${statusCode}). Please try again in a few moments.`);
      }

      const errorMessage = errorData?.error?.message || errorData?.message || statusText;
      throw new Error(`Groq API error (${statusCode}): ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Groq API');
    }

    const summaryText = data.choices[0].message.content.trim();
    const tokensUsed = data.usage?.total_tokens || 0;

    if (!summaryText || summaryText.length === 0) {
      throw new Error('Empty response from Groq API');
    }

    console.log('✅ Successfully received response from Groq API');
    console.log(`   Summary length: ${summaryText.length} characters`);
    console.log(`   Tokens used: ${tokensUsed} (prompt: ${data.usage?.prompt_tokens || 0}, completion: ${data.usage?.completion_tokens || 0})`);

    return {
      summary: summaryText,
      tokensUsed: tokensUsed,
    };
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Groq API Error:', error);
    console.error('   Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
    });

    // Handle network errors
    if (error.message?.includes('fetch') || error.message?.includes('network') ||
      error.message?.includes('ECONNREFUSED') || error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT') {
      throw new Error(`Network error connecting to Groq API: ${error.message}. Please check your internet connection.`);
    }

    // Re-throw with original message if it's already a formatted error
    if (error.message?.includes('Groq API') || error.message?.includes('API key')) {
      throw error;
    }

    // Generic error
    throw new Error(`Failed to generate summary: ${error.message || 'Unknown error occurred'}`);
  }
}

/**
 * Generate summary from document (supports PDFs and text files)
 * Note: Groq API doesn't support image analysis, so images need to be processed separately
 * @param {string} filePath - Path to the document file
 * @param {string} fileType - MIME type of the file
 * @param {string} summaryType - Type of summary
 * @param {string} summaryLength - Length of summary
 * @param {Object} advancedOptions - Additional options
 * @returns {Promise<{summary: string, tokensUsed: number}>} Generated summary and token usage
 */
export async function generateSummaryFromDocument(filePath, fileType, summaryType, summaryLength, advancedOptions = {}) {
  const fs = await import('fs');
  const path = await import('path');

  // Validate API key first
  getGroqApiKey();

  let content = '';

  // Check if it's a PDF
  if (fileType === 'application/pdf') {
    try {
      const pdfParse = await import('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const parsed = await pdfParse.default(buffer);
      content = parsed.text;
    } catch (error) {
      throw new Error('Failed to extract text from PDF. Please ensure the PDF contains text (not scanned images).');
    }
  } else if (fileType && fileType.startsWith('image/')) {
    // Groq doesn't support image analysis directly
    // You would need to use OCR or another service first
    throw new Error('Image processing is not supported with Groq API. Please extract text from images using OCR first, or use a different service.');
  } else {
    // For text files, read directly
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error('Failed to read document file');
    }
  }

  if (!content || content.trim().length === 0) {
    throw new Error('No content found in document. The document may be empty or contain only images without text.');
  }

  // Generate summary from extracted content
  return await generateSummary(content, summaryType, summaryLength, advancedOptions);
}

/**
 * Generate flashcards from textual content using Groq
 * @param {string} content - Text extracted from notes or documents
 * @param {Object} options - Additional options
 * @param {number} options.maxCards - Maximum number of flashcards to generate
 * @param {string} options.subject - Subject to apply when the model is unsure
 * @returns {Promise<Array>} Flashcard objects
 */
export async function generateFlashcardsFromContent(content, options = {}) {
  const apiKey = getGroqApiKey();

  if (!content || content.trim().length < 60) {
    throw new Error('Document content is too short to generate flashcards');
  }

  const {
    maxCards = 6,
    subject = 'General Studies',
    documentTitle = 'Study Notes',
    documentTags = [],
    isImageSource = false,
  } = options;

  const trimmedContent = content.trim().slice(0, 10000);
  const tagText = documentTags?.length ? documentTags.slice(0, 6).map((t) => `#${t}`).join(' ') : '';

  const systemPrompt = [
    'You are an expert study coach who transforms study material into high-quality flashcards.',
    `Generate up to ${maxCards} flashcards covering the most important facts, definitions, or concepts.`,
    'Output a pure JSON array. Do NOT include any explanations outside the JSON.',
    'Flashcard JSON schema:',
    '[{',
    '  "question": "Clear question text",',
    '  "answer": "Concise but complete answer",',
    '  "hint": "Optional hint or mnemonic (string)",',
    '  "difficulty": "easy|medium|advanced",',
    '  "subject": "Subject/category",',
    '  "tags": ["tag1","tag2"],',
    '  "examples": ["optional example sentences"]',
    '}]',
    `Document title: ${documentTitle}`,
    tagText ? `Document tags: ${tagText}` : 'Document tags: (not provided)',
    `Default subject if uncertain: ${subject}.`,
    'Questions must be unique, factual, and suitable for spaced repetition.',
    'Every flashcard MUST be grounded strictly in the provided content. Quote or paraphrase the relevant portion.',
    'Do NOT invent facts or use outside knowledge. If the content does not cover a topic, do not create a card about it.',
    'Prefer cloze-deletion style questions for formulas or key facts when appropriate.',
    'If the content is short, derive multiple perspectives (definition, example, consequence, comparison).',
    isImageSource
      ? 'The text was extracted from an image via OCR, so clean up spacing and assume minor typos. Focus on capturing what the text actually says.'
      : 'The text came from a typed document; retain important terminology verbatim.',
    'Before finalizing, double-check that each card\'s answer can be directly supported by a sentence in the provided content.',
  ].join('\n');

  try {
    console.log('🤖 Generating flashcards using Groq API...');

    const requestBody = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            `CONTENT START`,
            `${trimmedContent}`,
            `CONTENT END`,
            '',
            'For each flashcard, cite or reference the exact phrase used as the source (e.g., include a short quote in the explanation or answer).',
          ].join('\n'),
        },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();

    const cleaned = extractJsonArray(text);
    const flashcards = JSON.parse(cleaned);

    if (!Array.isArray(flashcards)) {
      throw new Error('Groq returned an unexpected format for flashcards');
    }

    return flashcards
      .map((card) => ({
        question: String(card.question || '').trim(),
        answer: String(card.answer || '').trim(),
        hint: card.hint ? String(card.hint).trim() : '',
        difficulty: normalizeDifficulty(card.difficulty),
        subject: String(card.subject || subject).trim(),
        tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        examples: Array.isArray(card.examples) ? card.examples.map((ex) => String(ex).trim()).filter(Boolean) : [],
      }))
      .filter((card) => card.question && card.answer);
  } catch (error) {
    console.error('❌ Flashcard generation error:', error);
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse Groq flashcard response. Try again with a shorter document.');
    }
    throw error;
  }
}

function extractJsonArray(text) {
  if (!text) return '[]';
  const withoutFences = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (withoutFences.startsWith('[') && withoutFences.endsWith(']')) {
    return withoutFences;
  }
  const start = withoutFences.indexOf('[');
  const end = withoutFences.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return withoutFences.slice(start, end + 1);
  }
  return withoutFences;
}

function normalizeDifficulty(value) {
  if (!value) return 'medium';
  const diff = String(value).toLowerCase();
  if (['easy', 'medium', 'advanced', 'hard'].includes(diff)) {
    return diff === 'hard' ? 'advanced' : diff;
  }
  return 'medium';
}

/**
 * Generate quiz questions from textual content using Groq
 * @param {string} content - Text extracted from notes or documents
 * @param {Object} options - Additional options
 * @param {number} options.maxQuestions - Maximum number of questions to generate
 * @param {string} options.subject - Subject to apply when the model is unsure
 * @returns {Promise<Array>} Question objects
 */
export async function generateQuestionsFromContent(content, options = {}) {
  const apiKey = getGroqApiKey();

  if (!content || content.trim().length < 100) {
    throw new Error('Document content is too short to generate quiz questions');
  }

  const {
    maxQuestions = 6,
    subject = 'General Studies',
    documentTitle = 'Study Notes',
    documentTags = [],
    isImageSource = false,
  } = options;

  const tagText = documentTags?.length ? documentTags.slice(0, 6).map((t) => `#${t}`).join(' ') : '';

  const systemPrompt = [
    'You are an expert quiz creator who transforms study material into high-quality multiple-choice quiz questions.',
    `Generate up to ${maxQuestions} quiz questions covering the most important facts, definitions, or concepts from the content.`,
    'Output a pure JSON array. Do NOT include any explanations outside the JSON.',
    'Question JSON schema:',
    '[{',
    '  "question": "Clear, specific question text",',
    '  "options": ["Option A", "Option B", "Option C", "Option D"],',
    '  "correctAnswer": 0,',
    '  "explanation": "Brief explanation of why the correct answer is right",',
    '  "category": "Topic/category name",',
    '  "difficulty": "easy|medium|hard",',
    '  "timeLimit": 60',
    '}]',
    `Document title: ${documentTitle}`,
    tagText ? `Document tags: ${tagText}` : 'Document tags: (not provided)',
    `Default subject if uncertain: ${subject}.`,
    'IMPORTANT RULES:',
    '1. Every question MUST be grounded strictly in the provided content. Do NOT invent facts.',
    '2. Each question must have exactly 4 options (A, B, C, D).',
    '3. correctAnswer must be 0, 1, 2, or 3 (index of the correct option).',
    '4. Make incorrect options plausible but clearly wrong.',
    '5. Questions should test understanding, not just memorization.',
    '6. Vary difficulty levels (easy, medium, hard) based on complexity.',
    '7. Include clear explanations for each answer.',
    isImageSource
      ? 'The text was extracted from an image via OCR, so clean up spacing and assume minor typos.'
      : 'The text came from a typed document; retain important terminology verbatim.',
    'Before finalizing, verify that each question\'s correct answer can be directly supported by the content.',
  ].join('\n');

  try {
    console.log('🤖 Generating quiz questions using Groq API...');

    const trimmedContent = content.trim().slice(0, 15000);
    const requestBody = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            `CONTENT START`,
            `${trimmedContent}`,
            `CONTENT END`,
            '',
            'For each question, ensure the correct answer is clearly supported by the content above.',
          ].join('\n'),
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || '';
    if (!responseText) {
      throw new Error('Empty response from Groq API');
    }

    const jsonText = extractJsonArray(responseText);
    let questions = JSON.parse(jsonText);

    if (!Array.isArray(questions)) {
      questions = [questions];
    }

    // Validate and normalize questions
    const validatedQuestions = questions
      .filter((q) => {
        return (
          q &&
          q.question &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          q.options.length <= 6 &&
          typeof q.correctAnswer === 'number' &&
          q.correctAnswer >= 0 &&
          q.correctAnswer < q.options.length
        );
      })
      .map((q) => ({
        question: String(q.question).trim(),
        options: q.options.map((opt) => String(opt).trim()).filter(Boolean),
        correctAnswer: Math.max(0, Math.min(q.options.length - 1, parseInt(q.correctAnswer))),
        explanation: String(q.explanation || '').trim(),
        category: String(q.category || subject).trim(),
        difficulty: (() => {
          const diff = normalizeDifficulty(q.difficulty);
          return diff === 'advanced' ? 'hard' : (diff === 'easy' || diff === 'medium' || diff === 'hard' ? diff : 'medium');
        })(),
        subject: subject,
        tags: Array.isArray(q.tags) ? q.tags.map((t) => String(t).trim().toLowerCase()) : [],
        timeLimit: parseInt(q.timeLimit) || 60,
        points: 10,
      }))
      .slice(0, maxQuestions);

    if (validatedQuestions.length === 0) {
      throw new Error('No valid questions were generated from this document');
    }

    console.log(`✅ Generated ${validatedQuestions.length} quiz questions`);
    return validatedQuestions;
  } catch (error) {
    console.error('❌ Groq question generation error:', error);
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse Groq question response. Try again with a shorter document.');
    }
    throw error;
  }
}

