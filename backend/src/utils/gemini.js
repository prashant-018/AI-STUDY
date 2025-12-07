import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Initialize Google Gemini client - will be created when needed
let genAI = null;

function getGenAI() {
  if (!genAI) {
    // Check environment variables - do NOT use hardcoded fallback
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    // Log what we found for debugging
    console.log('🔍 Checking for Gemini API key...');
    console.log(`   GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`   GOOGLE_GEMINI_API_KEY exists: ${!!process.env.GOOGLE_GEMINI_API_KEY}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   Current working directory: ${process.cwd()}`);

    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ GEMINI_API_KEY is not configured in environment variables');
      console.error('   Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file');
      console.error('   Get your API key from: https://makersuite.google.com/app/apikey');
      console.error('   Make sure to:');
      console.error('   1. Create a .env file in the backend directory (AI STUDY/backend/.env)');
      console.error('   2. Add: GEMINI_API_KEY=your-api-key-here');
      console.error('   3. Do NOT use quotes around the API key');
      console.error('   4. Restart the server after adding the API key');
      throw new Error('GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file.');
    }

    // Remove quotes if present (common mistake in .env files)
    let trimmedKey = apiKey.trim();
    if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
      (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
      console.warn('⚠️  API key has quotes - removing them');
      trimmedKey = trimmedKey.slice(1, -1).trim();
    }

    if (!trimmedKey.startsWith('AIza')) {
      console.error('❌ Invalid GEMINI_API_KEY format');
      console.error('   API key should start with "AIza"');
      console.error(`   Current key starts with: ${trimmedKey.substring(0, Math.min(4, trimmedKey.length))}`);
      console.error(`   API key length: ${trimmedKey.length}`);
      throw new Error('Invalid GEMINI_API_KEY format. API key should start with "AIza".');
    }

    try {
      console.log('✅ Google Gemini API initialized successfully');
      console.log(`   API Key: ${trimmedKey.substring(0, 10)}...${trimmedKey.substring(trimmedKey.length - 4)}`);
      genAI = new GoogleGenerativeAI(trimmedKey);
    } catch (error) {
      console.error('❌ Failed to initialize GoogleGenerativeAI:', error);
      throw new Error(`Failed to initialize Gemini API: ${error.message}`);
    }
  }
  return genAI;
}

/**
 * Generate AI summary using Google Gemini API
 * @param {string} noteContent - The note content to summarize
 * @param {string} summaryType - Type of summary: 'key_points', 'structured', 'simplified', 'exam_focus'
 * @param {string} summaryLength - Length: 'brief', 'standard', 'detailed'
 * @param {Object} advancedOptions - Additional options for customization
 * @returns {Promise<string>} Generated summary text
 */
export async function generateSummary(noteContent, summaryType, summaryLength, advancedOptions = {}) {
  // Validate API key first - do NOT use hardcoded fallback
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    const errorMsg = 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file. Get your API key from: https://makersuite.google.com/app/apikey';
    console.error('❌', errorMsg);
    console.error('   Current working directory:', process.cwd());
    console.error('   Check if .env file exists in:', path.join(process.cwd(), '.env'));
    throw new Error(errorMsg);
  }

  // Remove quotes if present (common mistake in .env files)
  let trimmedKey = apiKey.trim();
  if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
    (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
    console.warn('⚠️  API key has quotes - removing them');
    trimmedKey = trimmedKey.slice(1, -1).trim();
  }

  // Validate API key format (should start with AIza)
  if (!trimmedKey.startsWith('AIza')) {
    const errorMsg = `Invalid GEMINI_API_KEY format. API key should start with "AIza" but starts with "${trimmedKey.substring(0, Math.min(4, trimmedKey.length))}". Please check your API key.`;
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`🔑 Using Gemini API key: ${trimmedKey.substring(0, 10)}...`);

  // Build system prompt based on summaryType
  let systemPrompt = 'You are an expert educational content summarizer. Your task is to create clear, accurate, and well-structured summaries of educational notes.';

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
    brief: 'Keep it very concise, 50-100 words only. Focus on the most essential points.',
    standard: 'Provide a balanced summary of 200-300 words with good coverage of main topics.',
    detailed: 'Create a comprehensive summary of 400-500 words with thorough coverage and depth.',
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
    console.log('🤖 Connecting to Google Gemini API...');

    // Try different model names in order of preference
    const modelNames = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
    ];

    const genAIClient = getGenAI();
    let model = null;
    let lastError = null;
    let usedModel = null;

    const prompt = `${systemPrompt}\n\nSummarize this educational note:\n\n${noteContent}`;
    console.log(`   Summary Type: ${summaryType}, Length: ${summaryLength}`);

    // Try each model until one works
    let summaryText = null;
    for (const modelName of modelNames) {
      try {
        console.log(`   Trying model: ${modelName}`);
        model = genAIClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: summaryLength === 'brief' ? 200 : summaryLength === 'standard' ? 500 : 1000,
            temperature: 0.7,
          },
        });

        console.log('📤 Sending request to Gemini API...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        summaryText = response.text();

        if (summaryText && summaryText.trim().length > 0) {
          usedModel = modelName;
          console.log(`✅ Model ${modelName} worked successfully`);
          break;
        }
      } catch (modelError) {
        console.log(`   ⚠️  Model ${modelName} failed: ${modelError.message?.substring(0, 100)}`);
        lastError = modelError;

        // If it's not a model-not-found error, don't try other models
        if (!modelError.message?.includes('not found') &&
          !modelError.message?.includes('MODEL_NOT_FOUND') &&
          !modelError.message?.includes('not supported') &&
          modelError.status !== 404) {
          throw modelError; // Re-throw non-model errors
        }
        continue;
      }
    }

    if (!summaryText || !usedModel) {
      const errorMsg = `None of the Gemini models are available. This could mean:
1. Your API key does not have access to Gemini models
2. The models are not available in your region  
3. Your API key is invalid or expired

Please check your API key at: https://makersuite.google.com/app/apikey
Make sure the API key has Gemini API access enabled.

Last error: ${lastError?.message || 'Unknown error'}`;
      throw new Error(errorMsg);
    }

    console.log('✅ Successfully received response from Gemini API');
    console.log(`   Summary length: ${summaryText.length} characters`);

    return summaryText.trim();
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Gemini API Error:', error);
    console.error('   Error details:', {
      message: error.message,
      name: error.name,
      status: error.status,
      statusText: error.statusText,
      code: error.code,
      cause: error.cause,
      response: error.response,
    });

    // Log full error for debugging
    if (error.cause) {
      console.error('   Error cause:', error.cause);
    }
    if (error.response) {
      console.error('   API Response:', JSON.stringify(error.response, null, 2));
    }

    // Extract more detailed error message
    let detailedMessage = error.message || 'Unknown error occurred';
    if (error.cause?.message) {
      detailedMessage = `${detailedMessage} (Cause: ${error.cause.message})`;
    }
    if (error.response?.error?.message) {
      detailedMessage = `${detailedMessage} (API: ${error.response.error.message})`;
    }

    // Handle specific API errors with better messages
    if (error.message?.includes('API key') || error.message?.includes('not configured') || error.message?.includes('Invalid')) {
      const errorMsg = 'Google Gemini API key is missing or invalid. Please check your GEMINI_API_KEY in the .env file. Get your API key from: https://makersuite.google.com/app/apikey';
      console.error('   🔴 API Key Error:', errorMsg);
      throw new Error(errorMsg);
    }

    if (error.status === 401 || error.status === 403 || error.message?.includes('PERMISSION_DENIED') || error.message?.includes('unauthorized') || error.message?.includes('API_KEY_INVALID')) {
      const errorMsg = 'Invalid or unauthorized Google Gemini API key. Please verify your API key is correct and has proper permissions. Get your API key from: https://makersuite.google.com/app/apikey';
      console.error('   🔴 Authentication Error:', errorMsg);
      throw new Error(errorMsg);
    }

    if (error.status === 404 || error.message?.includes('not found') || error.message?.includes('not supported') || error.message?.includes('MODEL_NOT_FOUND') || error.message?.includes('None of the Gemini models')) {
      const errorMsg = 'Gemini models are not available. This could mean:\n' +
        '1. Your API key does not have access to Gemini models\n' +
        '2. The models are not available in your region\n' +
        '3. Your API key is invalid or expired\n\n' +
        'Please check your API key at: https://makersuite.google.com/app/apikey\n' +
        'Make sure the API key has Gemini API access enabled.';
      throw new Error(errorMsg);
    }

    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Google Gemini API quota exceeded or rate limit reached. Please try again later or upgrade your API plan.');
    }

    // For 500/503 errors, include more detail but still provide helpful message
    if (error.status === 500 || error.status === 503 || error.message?.includes('INTERNAL') || error.message?.includes('UNAVAILABLE') || error.message?.includes('SERVICE_UNAVAILABLE')) {
      const errorMsg = `Google Gemini API server error (${error.status || '500/503'}). ${detailedMessage}. Please try again in a few moments.`;
      console.error('   🔴 Server Error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Check for network errors
    if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('ECONNREFUSED') || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      throw new Error(`Network error connecting to Google Gemini API: ${detailedMessage}. Please check your internet connection.`);
    }

    // For Google API specific errors, check response structure
    if (error.response?.error) {
      const apiError = error.response.error;
      if (apiError.message) {
        throw new Error(`Google Gemini API error: ${apiError.message}`);
      }
      if (apiError.status) {
        throw new Error(`Google Gemini API error (${apiError.status}): ${apiError.message || detailedMessage}`);
      }
    }

    // Generic error with original message - preserve all details
    throw new Error(`Failed to generate summary: ${detailedMessage}`);
  }
}

/**
 * Extract text from image using Google Gemini Vision API
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Extracted text from image
 */
export async function extractTextFromImage(imagePath) {
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  // Debug logging
  console.log('🔍 Checking API key configuration...');
  console.log(`   GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`   GOOGLE_GEMINI_API_KEY exists: ${!!process.env.GOOGLE_GEMINI_API_KEY}`);

  if (!apiKey || apiKey.trim() === '') {
    console.error('❌ GEMINI_API_KEY is not configured');
    console.error('   Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file');
    console.error('   Get your API key from: https://makersuite.google.com/app/apikey');
    console.error('   Make sure to restart the server after adding the API key to .env');
    throw new Error('GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file.');
  }

  // Remove quotes if present (common mistake in .env files)
  let trimmedKey = apiKey.trim();
  if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
    (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
    console.warn('⚠️  API key has quotes - removing them');
    trimmedKey = trimmedKey.slice(1, -1).trim();
  }

  // Validate API key format
  if (!trimmedKey.startsWith('AIza')) {
    console.error('❌ Invalid GEMINI_API_KEY format');
    console.error(`   API key should start with "AIza" but starts with "${trimmedKey.substring(0, Math.min(4, trimmedKey.length))}"`);
    console.error(`   API key length: ${trimmedKey.length}`);
    console.error('   Common issues:');
    console.error('   - API key has extra quotes (remove quotes from .env file)');
    console.error('   - API key has leading/trailing spaces');
    console.error('   - Wrong API key copied (make sure it starts with AIza)');
    throw new Error(`Invalid GEMINI_API_KEY format. API key should start with "AIza" but starts with "${trimmedKey.substring(0, Math.min(4, trimmedKey.length))}". Please check your API key in the .env file.`);
  }

  console.log(`✅ API key format validated (length: ${trimmedKey.length})`);

  try {
    console.log('📷 Starting image text extraction...');
    console.log(`   Image path: ${imagePath}`);

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageSizeKB = (imageBuffer.length / 1024).toFixed(2);
    console.log(`   Image size: ${imageSizeKB} KB`);

    // Determine MIME type from file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    console.log(`   MIME type: ${mimeType}`);

    // Use Gemini model (supports vision) - try multiple models
    console.log('🤖 Connecting to Google Gemini API for image analysis...');

    const modelNames = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];

    // Use the trimmed key (without quotes) for API calls
    const genAIClient = new GoogleGenerativeAI(trimmedKey);
    let model = null;
    let usedModel = null;
    let extractedText = null;
    let lastError = null;

    const prompt = 'Extract all text from this image. If this is a document, note, or educational material, extract all the text content accurately. Preserve the structure and formatting as much as possible. If there are diagrams or images, describe them briefly.';

    // Try each model until one works
    for (const modelName of modelNames) {
      try {
        console.log(`   Trying model: ${modelName}`);
        model = genAIClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 4000,
            temperature: 0.4, // Lower temperature for more accurate text extraction
          },
        });

        console.log('📤 Sending image to Gemini API...');
        const result = await model.generateContent([
          {
            text: prompt,
          },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ]);

        const response = await result.response;
        extractedText = response.text();

        if (extractedText && extractedText.trim().length > 0) {
          usedModel = modelName;
          console.log(`✅ Model ${modelName} worked successfully`);
          break;
        }
      } catch (modelError) {
        console.log(`   ⚠️  Model ${modelName} failed: ${modelError.message?.substring(0, 100)}`);
        lastError = modelError;

        // Check for API key errors first - don't try other models if it's an auth error
        if (modelError.status === 401 || modelError.status === 403 ||
          modelError.message?.includes('API key') ||
          modelError.message?.includes('invalid') ||
          modelError.message?.includes('PERMISSION_DENIED') ||
          modelError.message?.includes('API_KEY_INVALID') ||
          modelError.message?.includes('unauthorized')) {
          console.error('   🔴 API Key Error detected - stopping model attempts');
          throw new Error('Invalid Google Gemini API key. Please check your GEMINI_API_KEY configuration. Make sure the key is correct and has proper permissions. Get your API key from: https://makersuite.google.com/app/apikey');
        }

        // If it's not a model-not-found error, don't try other models
        if (!modelError.message?.includes('not found') &&
          !modelError.message?.includes('MODEL_NOT_FOUND') &&
          !modelError.message?.includes('not supported') &&
          modelError.status !== 404) {
          throw modelError;
        }
        continue;
      }
    }

    if (!extractedText || !usedModel || extractedText.trim().length === 0) {
      throw new Error(`No Gemini models are available for image processing or no text was extracted. Please check your API key permissions. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    console.log('✅ Successfully extracted text from image');
    console.log(`   Extracted text length: ${extractedText.length} characters`);

    return extractedText.trim();
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Image text extraction error:', error);
    console.error('   Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      code: error.code,
      name: error.name,
      cause: error.cause,
      response: error.response,
    });

    // Log the full error for debugging
    if (error.response) {
      console.error('   API Response:', JSON.stringify(error.response, null, 2));
    }
    if (error.cause) {
      console.error('   Error cause:', error.cause);
    }

    // Extract more detailed error message
    let detailedMessage = error.message || 'Unknown error occurred';
    if (error.cause?.message) {
      detailedMessage = `${detailedMessage} (Cause: ${error.cause.message})`;
    }
    if (error.response?.error?.message) {
      detailedMessage = `${detailedMessage} (API: ${error.response.error.message})`;
    }

    // Handle specific API errors
    if (error.status === 401 || error.status === 403 ||
      error.message?.includes('API key') ||
      error.message?.includes('invalid') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('API_KEY_INVALID') ||
      error.message?.includes('unauthorized')) {
      console.error('   🔴 API Key Error: Invalid or unauthorized API key');
      const errorMsg = 'Invalid Google Gemini API key. Please check your GEMINI_API_KEY configuration. Make sure the key is correct and has proper permissions. Get your API key from: https://makersuite.google.com/app/apikey';
      throw new Error(errorMsg);
    }

    if (error.status === 404 || error.message?.includes('not found') || error.message?.includes('not supported')) {
      throw new Error('Gemini model not found or not supported. The model gemini-1.5-flash may not be available. Please check available models.');
    }

    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Google Gemini API quota exceeded or rate limit reached. Please try again later.');
    }

    if (error.status === 500 || error.status === 503 || error.message?.includes('INTERNAL') || error.message?.includes('UNAVAILABLE') || error.message?.includes('SERVICE_UNAVAILABLE')) {
      const errorMsg = `Google Gemini API server error (${error.status || '500/503'}). ${detailedMessage}. Please try again later.`;
      console.error('   🔴 Server Error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Check for network errors
    if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('ECONNREFUSED') || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      throw new Error(`Network error connecting to Google Gemini API: ${detailedMessage}. Please check your internet connection.`);
    }

    // For Google API specific errors, check response structure
    if (error.response?.error) {
      const apiError = error.response.error;
      if (apiError.message) {
        throw new Error(`Google Gemini API error: ${apiError.message}`);
      }
      if (apiError.status) {
        throw new Error(`Google Gemini API error (${apiError.status}): ${apiError.message || detailedMessage}`);
      }
    }

    throw new Error(`Failed to extract text from image: ${detailedMessage}`);
  }
}

/**
 * Generate summary from document (supports both text and images)
 * @param {string} filePath - Path to the document file
 * @param {string} fileType - MIME type of the file
 * @param {string} summaryType - Type of summary
 * @param {string} summaryLength - Length of summary
 * @param {Object} advancedOptions - Additional options
 * @returns {Promise<string>} Generated summary
 */
export async function generateSummaryFromDocument(filePath, fileType, summaryType, summaryLength, advancedOptions = {}) {
  // Validate API key first before processing - do NOT use hardcoded fallback
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in your .env file. Get your API key from: https://makersuite.google.com/app/apikey');
  }

  // Remove quotes if present (common mistake in .env files)
  let trimmedKey = apiKey.trim();
  if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
    (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
    console.warn('⚠️  API key has quotes - removing them');
    trimmedKey = trimmedKey.slice(1, -1).trim();
  }

  if (!trimmedKey.startsWith('AIza')) {
    throw new Error(`Invalid GEMINI_API_KEY format. API key should start with "AIza" but starts with "${trimmedKey.substring(0, Math.min(4, trimmedKey.length))}". Please check your API key.`);
  }

  let content = '';

  // Check if it's an image
  if (fileType && fileType.startsWith('image/')) {
    console.log('📷 Processing image file...');
    content = await extractTextFromImage(filePath);
    console.log(`✅ Extracted ${content.length} characters from image`);
  } else if (fileType === 'application/pdf') {
    // For PDFs, extract text using pdf-parse
    try {
      const pdfParse = await import('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const parsed = await pdfParse.default(buffer);
      content = parsed.text;
    } catch (error) {
      throw new Error('Failed to extract text from PDF. Please ensure the PDF contains text (not scanned images).');
    }
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
 * Generate flashcards from textual content using Gemini
 * @param {string} content - Text extracted from notes or documents
 * @param {Object} options - Additional options
 * @param {number} options.maxCards - Maximum number of flashcards to generate
 * @param {string} options.subject - Subject to apply when the model is unsure
 * @returns {Promise<Array>} Flashcard objects
 */
export async function generateFlashcardsFromContent(content, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set it in your .env file.');
  }

  if (!content || content.trim().length < 60) {
    throw new Error('Document content is too short to generate flashcards');
  }

  const {
    maxCards = 6,
    subject = 'General Studies',
  } = options;

  const trimmedContent = content.trim().slice(0, 10000);
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
    `Default subject if uncertain: ${subject}.`,
    'Questions must be unique, factual, and suitable for spaced repetition.',
  ].join('\n');

  try {
    // Try different model names
    const modelNames = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];

    const genAIClient = getGenAI();
    let model = null;
    let usedModel = null;

    const prompt = `${systemPrompt}\n\nCONTENT START\n${trimmedContent}\nCONTENT END`;
    let text = null;
    let lastError = null;

    // Try each model until one works
    for (const modelName of modelNames) {
      try {
        model = genAIClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 1200,
            temperature: 0.4,
          },
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();

        if (text && text.trim().length > 0) {
          usedModel = modelName;
          break;
        }
      } catch (modelError) {
        lastError = modelError;
        // If it's not a model-not-found error, don't try other models
        if (!modelError.message?.includes('not found') &&
          !modelError.message?.includes('MODEL_NOT_FOUND') &&
          !modelError.message?.includes('not supported') &&
          modelError.status !== 404) {
          throw modelError;
        }
        continue;
      }
    }

    if (!text || !usedModel) {
      throw new Error(`No Gemini models are available for flashcard generation. Please check your API key permissions. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    const cleaned = extractJsonArray(text);
    const flashcards = JSON.parse(cleaned);

    if (!Array.isArray(flashcards)) {
      throw new Error('Gemini returned an unexpected format for flashcards');
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
      throw new Error('Failed to parse Gemini flashcard response. Try again with a shorter document.');
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


