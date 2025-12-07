import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

const configurePassport = () => {
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('-password');
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Validate required environment variables
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectURI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn('⚠️  Google OAuth credentials not configured. Google login will not work.');
    return;
  }

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: redirectURI,
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('🔍 Google OAuth Profile:', {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value
          });

          if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
            console.error('❌ No email found in Google profile');
            return done(new Error('No email found in Google account'), null);
          }

          const email = profile.emails[0].value.toLowerCase().trim();
          const googleId = profile.id;
          const name = profile.displayName || profile.name?.givenName || 'User';
          const picture = profile.photos?.[0]?.value || null;

          // Check if user already exists
          let user = await User.findOne({
            $or: [
              { googleId },
              { email }
            ]
          });

          if (user) {
            // Update existing user with Google info if not already set
            if (!user.googleId) {
              user.googleId = googleId;
              user.authProvider = 'google';
            }
            if (!user.profilePicture && picture) {
              user.profilePicture = picture;
            }
            if (!user.isVerified) {
              user.isVerified = true;
            }
            await user.save();
            console.log('✅ Existing user logged in:', user.email);
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            googleId,
            name,
            email,
            profilePicture: picture,
            isVerified: true, // Google accounts are pre-verified
            authProvider: 'google'
          });

          await newUser.save();
          console.log('✅ New Google user created:', newUser.email);
          return done(null, newUser);

        } catch (error) {
          console.error('❌ Google OAuth Error:', error);
          return done(error, null);
        }
      }
    )
  );
};

export default configurePassport;