import jwt from 'jsonwebtoken';

export const createToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not configured in environment variables');
    throw new Error('JWT_SECRET not configured');
  }
  // Token expires in 7 days to match cookie maxAge
  return jwt.sign({ id }, secret, { expiresIn: '7d' });
};

