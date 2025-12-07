import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { createToken } from '../utils/tokenUtils.js';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'general', message: 'Name, email and password are required' }]
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'name', message: 'Name must be at least 2 characters' }]
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password must be at least 6 characters' }]
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
        errors: [{ field: 'email', message: 'Email already exists' }]
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hash
    });

    const token = createToken(user._id.toString());
    setAuthCookie(res, token);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      picture: user.profilePicture || null,
      role: user.role,
      createdAt: user.createdAt
    };

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: safeUser,
      token: token
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Registration failed',
      errors: [{ field: 'general', message: 'Internal server error' }]
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'general', message: 'Email and password are required' }]
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: 'Invalid email or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: 'Invalid email or password'
      });
    }

    const token = createToken(user._id.toString());
    setAuthCookie(res, token);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      picture: user.profilePicture || null,
      role: user.role,
      createdAt: user.createdAt
    };

    return res.json({
      success: true,
      message: 'Login successful',
      user: safeUser,
      token: token
    });
  } catch (err) {
    console.error('❌ /api/auth/login error:', err);
    console.error('   Error message:', err?.message);
    console.error('   Error stack:', err?.stack);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Login failed',
      error: 'Internal server error',
      errors: [{ field: 'general', message: 'Internal server error' }]
    });
  }
};

export const me = async (req, res) => {
  try {
    // Check if user exists (should be set by authRequired middleware)
    if (!req.user) {
      console.error('❌ /api/auth/me: req.user is undefined');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated'
      });
    }

    const safeUser = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      picture: req.user.profilePicture || null,
      role: req.user.role,
      createdAt: req.user.createdAt
    };
    return res.json({
      success: true,
      user: safeUser
    });
  } catch (err) {
    console.error('❌ /api/auth/me error:', err);
    console.error('   Error message:', err?.message);
    console.error('   Error stack:', err?.stack);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to get user',
      error: 'Internal server error',
      errors: [{ field: 'general', message: 'Internal server error' }]
    });
  }
};

export const logout = async (_req, res) => {
  try {
    clearAuthCookie(res);
    return res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Logout failed',
      errors: [{ field: 'general', message: 'Internal server error' }]
    });
  }
};

// Google OAuth callback handler
export const googleCallback = async (req, res) => {
  try {
    console.log('✅ Google OAuth callback handler');
    console.log('   Request cookies:', req.cookies ? Object.keys(req.cookies) : 'none');

    const user = req.user; // Set by passport after authentication

    if (!user) {
      console.error('❌ No user found after OAuth');
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/?error=google_auth_failed&reason=no_user`);
    }

    console.log('✅ User authenticated:', user.email);
    console.log('   User ID:', user._id);

    // Generate JWT token
    const token = createToken(user._id.toString());
    console.log('✅ JWT token generated');
    console.log('   Token length:', token.length);

    // Set httpOnly cookie BEFORE redirect
    // CRITICAL: Cookie must be set on the response before redirect
    setAuthCookie(res, token);

    // Verify cookie was set in response headers
    const setCookieHeader = res.getHeader('Set-Cookie');
    if (setCookieHeader) {
      const headerStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      console.log('✅ Cookie header set:', headerStr.substring(0, 80) + '...');
      console.log('   Cookie will be sent with subsequent requests');
    } else {
      console.error('❌ WARNING: Set-Cookie header not found in response!');
    }

    // IMPORTANT: For Next.js proxy, we need to ensure the cookie works
    // The cookie is set on the backend domain (localhost:5000)
    // But requests go through Next.js proxy (localhost:3000)
    // So we also include token in URL as primary method for Next.js proxy

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    // Set cookie for direct backend access
    // Also include token in URL for Next.js proxy to use
    const redirectUrl = `${frontendUrl}/auth/callback?success=true&token=${encodeURIComponent(token)}`;

    console.log('🔄 Redirecting to frontend');
    console.log('   Cookie set for backend domain (localhost:5000)');
    console.log('   Token in URL for Next.js proxy (localhost:3000)');
    console.log('   Redirect URL:', redirectUrl.replace(token, 'TOKEN_HIDDEN'));

    // Use redirect - cookie is already set in response headers
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('❌ Google callback error:', err.message);
    console.error('   Stack:', err.stack);
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/?error=google_auth_failed&reason=${encodeURIComponent(err.message)}`);
  }
};
