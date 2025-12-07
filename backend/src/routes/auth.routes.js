import express from 'express';
import passport from 'passport';
import { login, register, logout, me } from '../controllers/auth.controller.js';
import { authRequired, setAuthCookie } from '../middleware/authMiddleware.js';
import { createToken } from '../utils/tokenUtils.js';

const router = express.Router();

// Local auth endpoints
router.post('/register', register);
router.post('/login', login);
router.get('/me', authRequired, me);
router.post('/logout', logout);

// Google OAuth login
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account' // Always show account selection
  })
);

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        console.error('❌ No user found in OAuth callback');
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=no_user`);
      }

      // Generate JWT token consistent with other auth flows
      const token = createToken(user._id.toString());

      // Set cookie using shared helper so middleware can read it
      setAuthCookie(res, token);

      console.log('✅ OAuth login successful for:', user.email);

      const redirectBase = process.env.CLIENT_URL || 'http://localhost:3000';
      // Include token in query so frontend can persist it
      res.redirect(`${redirectBase}/auth/callback?success=true&token=${encodeURIComponent(token)}`);

    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=server_error`);
    }
  }
);

// Health check for OAuth
router.get('/oauth/status', (req, res) => {
  const isConfigured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'YOUR_GOOGLE_CLIENT_SECRET_HERE'
  );

  res.json({
    success: true,
    oauth: {
      google: {
        configured: isConfigured,
        clientId: process.env.GOOGLE_CLIENT_ID ?
          process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' :
          'Not set',
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
      }
    }
  });
});

export default router;