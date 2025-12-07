import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const TOKEN_COOKIE = 'token';

const extractTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies?.[TOKEN_COOKIE]) {
    return req.cookies[TOKEN_COOKIE];
  }
  return null;
};

const verifyJwt = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, secret);
};

export const authRequired = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'No token provided'
      });
    }

    const payload = verifyJwt(token);
    const user = await User.findById(payload.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'User associated with this token no longer exists'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    const status = error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: status === 401 ? 'Authentication failed' : 'Server error',
      error: error.message || 'Unable to authenticate request'
    });
  }
};

export const optionalAuth = async (req, _res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return next();
    }

    const payload = verifyJwt(token);
    const user = await User.findById(payload.id).select('-password');
    if (user) {
      req.user = user;
    }
  } catch (_error) {
    // Ignore optional auth errors
  }
  next();
};

export const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
};

export const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  });
};



