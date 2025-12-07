import { testGroqAPI } from '../utils/testGroq.js';

export const root = async (_req, res) => {
  res.json({ message: 'Welcome to AI Study Buddy API' });
};

export const health = async (_req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  const groqStatus = apiKey && apiKey.trim() !== ''
    ? 'configured'
    : 'not configured';

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      groq: groqStatus
    },
    env: {
      hasGroqKey: !!apiKey,
      keyLength: apiKey ? apiKey.length : 0,
      keyStartsWithGsk: apiKey ? apiKey.trim().startsWith('gsk_') : false,
      workingDir: process.cwd()
    }
  });
};

export const testGroq = async (_req, res) => {
  try {
    // First, check if API key is configured
    const apiKey = process.env.GROQ_API_KEY;
    const apiKeyStatus = {
      configured: !!(apiKey && apiKey.trim() !== ''),
      length: apiKey ? apiKey.length : 0,
      startsWithGsk: apiKey ? apiKey.trim().startsWith('gsk_') : false,
      preview: apiKey && apiKey.trim().length > 0
        ? `${apiKey.trim().substring(0, 10)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`
        : 'not set',
    };

    if (!apiKeyStatus.configured) {
      return res.status(500).json({
        success: false,
        error: 'GROQ_API_KEY is not configured',
        details: 'Please set GROQ_API_KEY in your .env file. Get your API key from: https://console.groq.com/keys',
        apiKeyStatus,
      });
    }

    // Now test the API
    const result = await testGroqAPI();
    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Groq API is working correctly',
        response: result.response,
        tokensUsed: result.tokensUsed,
        apiKeyStatus,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Groq API test failed',
        details: result.details,
        apiKeyStatus,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test Groq API',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Test cookie endpoint
export const testCookie = async (req, res) => {
  try {
    // Set a test cookie
    res.cookie('test-cookie', 'test-value', {
      httpOnly: true,
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 1000, // 1 minute
    });

    res.json({
      success: true,
      message: 'Test cookie set',
      cookiesReceived: req.cookies ? Object.keys(req.cookies) : [],
      testCookiePresent: !!req.cookies?.['test-cookie'],
      instructions: 'Check browser DevTools → Application → Cookies to see if cookie was set'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test cookie',
    });
  }
};
