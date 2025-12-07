import mongoose from 'mongoose';

const UserSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Profile Settings
    profile: {
      displayName: { type: String, default: null },
      bio: { type: String, default: null },
      avatar: { type: String, default: null },
      timezone: { type: String, default: 'UTC' },
      language: { type: String, default: 'en' },
    },
    // Notification Preferences
    notifications: {
      enabled: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      categories: {
        documents: { type: Boolean, default: true },
        flashcards: { type: Boolean, default: true },
        quiz: { type: Boolean, default: true },
        progress: { type: Boolean, default: true },
        profile: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        ai: { type: Boolean, default: true },
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: '22:00' }, // 10 PM
        end: { type: String, default: '08:00' },   // 8 AM
      },
    },
    // Study Preferences
    study: {
      defaultSubject: { type: String, default: null },
      studyGoal: { type: Number, default: 60 }, // minutes per day
      reminderTime: { type: String, default: '09:00' },
      autoFlashcards: { type: Boolean, default: true },
      spacedRepetition: { type: Boolean, default: true },
      difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'adaptive'],
        default: 'medium',
      },
    },
    // Flashcard Study Settings
    flashcardSettings: {
      autoFlip: { type: Boolean, default: false },
      showHints: { type: Boolean, default: true },
      defaultMode: {
        type: String,
        enum: ['standard', 'quick_review', 'exam_mode'],
        default: 'standard',
      },
      cardsPerSession: { type: Number, default: 20, min: 5, max: 100 },
    },
    // AI Preferences
    ai: {
      model: {
        type: String,
        enum: ['gemini', 'openai', 'auto'],
        default: 'gemini',
      },
      temperature: { type: Number, default: 0.7, min: 0, max: 1 },
      maxTokens: { type: Number, default: 2000 },
      autoSummary: { type: Boolean, default: true },
      autoFlashcards: { type: Boolean, default: true },
      studyPlanGeneration: { type: Boolean, default: true },
    },
    // Privacy Settings
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'private', 'friends'],
        default: 'private',
      },
      showProgress: { type: Boolean, default: false },
      showAchievements: { type: Boolean, default: true },
      dataSharing: { type: Boolean, default: false },
    },
    // Appearance Settings
    appearance: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
      fontSize: {
        type: String,
        enum: ['small', 'medium', 'large'],
        default: 'medium',
      },
      compactMode: { type: Boolean, default: false },
      animations: { type: Boolean, default: true },
    },
    // Security Settings
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      loginAlerts: { type: Boolean, default: true },
      sessionTimeout: { type: Number, default: 7 }, // days
      passwordChangeRequired: { type: Boolean, default: false },
    },
    // Storage Settings
    storage: {
      maxStorage: { type: Number, default: 1073741824 }, // 1GB in bytes
      autoCleanup: { type: Boolean, default: false },
      cleanupAfterDays: { type: Number, default: 90 },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// Create default settings when user is created
UserSettingsSchema.statics.createDefault = async function (userId) {
  return this.create({ userId });
};

const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema);

export default UserSettings;


