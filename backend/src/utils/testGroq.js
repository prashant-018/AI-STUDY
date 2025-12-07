/**
 * Test Groq API configuration
 * This can be run to verify the API key is working
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Updated from deprecated llama-3.1-70b-versatile

export async function testGroqAPI() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.error('❌ GROQ_API_KEY is not set');
    return { success: false, error: 'API key not configured' };
  }

  const trimmedKey = apiKey.trim();

  try {
    console.log('🧪 Testing Groq API connection...');

    const requestBody = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello" if you can read this.',
        },
      ],
      temperature: 0.5,
      max_tokens: 50,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${trimmedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || response.statusText || 'Unknown error';
      console.error('❌ Groq API test failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        details: 'Check your API key at https://console.groq.com/keys'
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (text) {
      console.log('✅ Groq API is working correctly!');
      return {
        success: true,
        message: 'API key is valid and working',
        response: text,
        tokensUsed: data.usage?.total_tokens || 0
      };
    } else {
      return { success: false, error: 'Empty response from API' };
    }
  } catch (error) {
    console.error('❌ Groq API test failed:', error.message);
    return {
      success: false,
      error: error.message,
      details: 'Check your API key at https://console.groq.com/keys'
    };
  }
}

