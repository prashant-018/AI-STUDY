// API Routes for AI Study Buddy (ES Modules)
// All responses are JSON; includes health, test, and sample data endpoints
import { Router } from 'express';

const router = Router();

// Root route - returns welcome message and API info
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to AI Study Buddy API',
    docs: '/api',
    routes: {
      health: '/api/health',
      test: '/api/test',
      studyTopics: '/api/study/topics',
    },
  });
});

// Health check route
router.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// Test API route
router.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend working!',
  });
});

// Study topics route - sample data
router.get('/api/study/topics', (req, res) => {
  const topics = [
    { id: 1, title: 'Linear Algebra', difficulty: 'Intermediate' },
    { id: 2, title: 'Data Structures', difficulty: 'Beginner' },
    { id: 3, title: 'Machine Learning Basics', difficulty: 'Intermediate' },
    { id: 4, title: 'System Design', difficulty: 'Advanced' },
  ];
  res.json({
    topics,
    count: topics.length,
  });
});

export default router;


