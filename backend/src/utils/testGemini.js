/**
 * Test Gemini API configuration
 * This can be run to verify the API key is working
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function testGeminiAPI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.error('❌ GEMINI_API_KEY is not set');
    return { success: false, error: 'API key not configured' };
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey.startsWith('AIza')) {
    console.error('❌ Invalid API key format');
    return { success: false, error: 'API key should start with "AIza"' };
  }

  try {
    console.log('🧪 Testing Gemini API connection...');
    const genAI = new GoogleGenerativeAI(trimmedKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const result = await model.generateContent('Say "Hello" if you can read this.');
    const response = await result.response;
    const text = response.text();

    if (text) {
      console.log('✅ Gemini API is working correctly!');
      return { success: true, message: 'API key is valid and working' };
    } else {
      return { success: false, error: 'Empty response from API' };
    }
  } catch (error) {
    console.error('❌ Gemini API test failed:', error.message);
    return {
      success: false,
      error: error.message,
      details: 'Check your API key at https://makersuite.google.com/app/apikey'
    };
  }
}


