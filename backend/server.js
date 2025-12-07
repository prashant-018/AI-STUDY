// Basic Express server setup for AI Study Buddy backend (ES Modules)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import apiRouter from './src/routes/api.routes.js';
import documentRoutes from './src/routes/documentRoutes.js';
import summariesRoutes from './src/routes/summaries.routes.js';
import statsRoutes from './src/routes/stats.routes.js';
import flashcardsRoutes from './src/routes/flashcards.routes.js';
import studySessionsRoutes from './src/routes/studySessions.routes.js';
import progressRoutes from './src/routes/progress.routes.js';
import questionRoutes from './src/routes/questionRoutes.js';
import quizModeRoutes from './src/routes/quizModeRoutes.js';
import resultRoutes from './src/routes/resultRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import activityRoutes from './src/routes/activityRoutes.js';
import searchRoutes from './src/routes/search.routes.js';
import { errorHandler, notFound } from './src/middleware/errorMiddleware.js';
import connectDB from './src/config/db.js';
import configurePassport from './src/config/passport.js';
import passport from 'passport';
import authRoutes from './src/routes/auth.routes.js';
import usersRoutes from './src/routes/users.routes.js';
import notesRoutes from './src/routes/notes.routes.js';
import storageRoutes from './src/routes/storage.routes.js';
import notificationsRoutes from './src/routes/notifications.routes.js';
import settingsRoutes from './src/routes/settings.routes.js';
import { root as rootHandler, health as healthHandler, testGroq as testGroqHandler, testCookie as testCookieHandler } from './src/controllers/health.controller.js';
import { createServer } from 'http';
import { initializeSocket } from './src/config/socket.js';
import { setSocketIO } from './src/services/notification.service.js';

const app = express();
const httpServer = createServer(app);

// Environment configuration
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

// Security middleware - configure helmet to allow cookies
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Disable CSP for development (can enable in production)
}));

// CORS configuration - CRITICAL for cookies to work
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);

      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development') {
        // In development, allow all localhost origins
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          callback(null, true);
        } else {
          callback(null, true); // Still allow for development
        }
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // CRITICAL: Must be true for cookies to work
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  })
);

// Body parsers
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true for HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Configure and initialize Passport for OAuth
configurePassport();
app.use(passport.initialize());
app.use(passport.session()); // Enable session support for Passport

// Routes
app.get('/', rootHandler);
app.get('/api/health', healthHandler);
app.get('/api/test/groq', testGroqHandler);
app.get('/api/test/cookie', testCookieHandler); // Test cookie endpoint
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes); // Also mount on /auth for OAuth callbacks (Google redirects here)
app.use('/users', usersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/', apiRouter);
app.use('/api/documents', documentRoutes);

// AI Summary Generator routes
app.use('/api/summaries', summariesRoutes);
app.use('/api/stats', statsRoutes);

// Flashcards Study System routes
app.use('/api/flashcards', flashcardsRoutes);
app.use('/api/study-sessions', studySessionsRoutes);
app.use('/api/progress', progressRoutes);

// QuizMaster routes
app.use('/api/questions', questionRoutes);
app.use('/api/quiz', quizModeRoutes);
app.use('/api/results', resultRoutes);

// StudyAI Dashboard routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);

// Search routes
app.use('/api/search', searchRoutes);

// Serve uploaded files statically
// Files are stored at: uploads/documents/{userId}/filename
// Accessible via: /uploads/documents/{userId}/filename
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Set proper Content-Type for images and other files
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// 404 handler for undefined routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Connect DB then start server
const start = async () => {
  try {
    // Validate critical environment variables
    console.log('\n🔍 Validating environment configuration...');
    const requiredEnvVars = {
      'MONGO_URI': process.env.MONGO_URI,
      'JWT_SECRET': process.env.JWT_SECRET,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error('\n❌ Missing required environment variables:', missingVars.join(', '));
      console.error('   Please check your .env file');
      console.error('');
      console.error('   📋 QUICK FIX:');
      console.error('   1. Create a .env file in the backend directory');
      console.error('   2. Copy the following minimum required variables:');
      console.error('');
      console.error('   MONGO_URI=mongodb://127.0.0.1:27017/study-ai');
      console.error('   JWT_SECRET=your-secure-random-secret-here');
      console.error('');
      console.error('   3. For MongoDB, make sure MongoDB is running on your system');
      console.error('   4. For JWT_SECRET, use a long random string (at least 32 characters)');
      console.error('   5. Restart the server after creating/updating .env');
      console.error('');
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}. Please create a .env file with these variables.`);
    } else {
      console.log('✅ Required environment variables are set');
    }

    // Check Google OAuth configuration
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

    if (!googleClientId || !googleClientSecret || googleClientSecret === 'your-google-client-secret-here') {
      console.warn('⚠️  Google OAuth is not fully configured');
      console.warn('   Google login will not work until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set');
    } else {
      console.log('✅ Google OAuth configuration detected');
      console.log(`   Callback URL: ${googleCallbackUrl}`);
      console.log('   ⚠️  Make sure this URL matches your Google Cloud Console redirect URI');
    }

    // Check Groq API configuration
    let groqApiKey = process.env.GROQ_API_KEY;

    // Log environment info for debugging
    console.log('🔍 Checking Groq API configuration...');
    console.log(`   Working directory: ${process.cwd()}`);
    console.log(`   .env file location: ${path.join(process.cwd(), '.env')}`);
    console.log(`   GROQ_API_KEY exists: ${!!process.env.GROQ_API_KEY}`);

    if (!groqApiKey || groqApiKey.trim() === '') {
      console.error('❌ Groq API is not configured');
      console.error('   AI summary generation will NOT work until GROQ_API_KEY is set');
      console.error('');
      console.error('   📋 SETUP INSTRUCTIONS:');
      console.error('   1. Create a .env file in the backend directory:');
      console.error(`      Location: ${path.join(process.cwd(), '.env')}`);
      console.error('   2. Add the following line to your .env file:');
      console.error('      GROQ_API_KEY=your-api-key-here');
      console.error('   3. Get your API key from: https://console.groq.com/keys');
      console.error('   4. ⚠️  IMPORTANT: Do NOT put quotes around the API key');
      console.error('      ✅ Correct: GROQ_API_KEY=gsk_...');
      console.error('      ❌ Wrong:   GROQ_API_KEY="gsk_..."');
      console.error('   5. Restart the server after adding the API key');
      console.error('');
    } else {
      // Remove quotes if present (common mistake)
      let trimmedKey = groqApiKey.trim();
      if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
        (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
        console.warn('⚠️  API key has quotes - this will be auto-corrected, but remove quotes from .env for best results');
        trimmedKey = trimmedKey.slice(1, -1).trim();
      }

      if (!trimmedKey.startsWith('gsk_')) {
        console.warn('⚠️  Groq API key format may be invalid');
        console.warn(`   API key should typically start with "gsk_" but starts with "${trimmedKey.substring(0, Math.min(4, trimmedKey.length))}"`);
        console.warn(`   API key length: ${trimmedKey.length}`);
        console.warn('   Please verify your API key in the .env file');
        console.warn('   Common issues:');
        console.warn('   - API key has quotes (remove quotes)');
        console.warn('   - Wrong API key copied');
        console.warn('   - Extra spaces before/after key');
      } else {
        console.log('✅ Groq API configuration detected');
        console.log(`   API Key: ${trimmedKey.substring(0, 10)}...${trimmedKey.substring(trimmedKey.length - 4)}`);
        console.log(`   Key length: ${trimmedKey.length} characters`);
        console.log('   Model: llama-3.3-70b-versatile');
        console.log('   Note: API key will be validated on first use');
        console.log('   Test endpoint: GET /api/test/groq');
      }
    }

    await connectDB();

    // Initialize Socket.io for real-time notifications
    const io = initializeSocket(httpServer);
    setSocketIO(io);
    console.log('✅ Socket.io initialized for real-time notifications');

    httpServer.listen(PORT, () => {
      console.log('\n✅ Backend server running on http://localhost:' + PORT);
      console.log(`🌐 CORS allowed origin: ${CLIENT_URL}`);
      console.log(`🧭 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Auth endpoints:`);
      console.log(`   - POST /api/auth/register`);
      console.log(`   - POST /api/auth/login`);
      console.log(`   - GET  /api/auth/me`);
      console.log(`   - POST /api/auth/logout`);
      console.log(`   - GET  /api/auth/google`);
      console.log(`   - GET  /api/auth/google/callback`);
      console.log(`📢 Socket.io enabled for real-time notifications`);
      console.log('');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err?.message || err);
    process.exit(1);
  }
};

start();


