import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        // Documents
        'document_ready',
        'document_processed',
        'ai_summary_ready',
        'document_removed',
        'document_process_failed',
        // Flashcards
        'flashcards_created',
        'flashcards_saved',
        'flashcards_updated',
        'flashcard_deleted',
        'review_due',
        'flashcards_added',
        // Quiz
        'quiz_generated',
        'quiz_finished',
        'quiz_submitted',
        'quiz_results_ready',
        // Progress
        'streak_maintained',
        'streak_broken',
        'weekly_report_ready',
        'task_completed',
        'pending_reviews',
        // Profile
        'profile_updated',
        'password_changed',
        'new_device_login',
        'google_login_failed',
        'logged_out',
        // Security
        'multiple_login_attempts',
        'suspicious_activity',
        'email_verified',
        'verification_failed',
        // AI
        'ai_study_plan_ready',
        'ai_chat_saved',
        'ai_analysis_error',
        'study_recommendations',
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['documents', 'flashcards', 'quiz', 'progress', 'profile', 'security', 'ai'],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Optional: link to related resource
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedType: {
      type: String,
      enum: ['document', 'flashcard', 'quiz', 'summary', 'session', null],
      default: null,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

// Indexes for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

export default Notification;


