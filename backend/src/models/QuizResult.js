import mongoose from 'mongoose';

const QuizResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    quizMode: {
      type: String,
      enum: ['practice', 'timed', 'exam'],
      required: true,
    },
    subject: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: null,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'mixed'],
      default: 'mixed',
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    correctAnswers: {
      type: Number,
      required: true,
      min: 0,
    },
    incorrectAnswers: {
      type: Number,
      required: true,
      min: 0,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    earnedPoints: {
      type: Number,
      default: 0,
    },
    timeSpent: {
      type: Number,
      default: 0, // seconds
    },
    timeLimit: {
      type: Number,
      default: null, // null for untimed quizzes
    },
    questions: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        question: String,
        userAnswer: Number,
        correctAnswer: Number,
        isCorrect: Boolean,
        timeSpent: Number, // seconds
        points: Number,
      },
    ],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    isCompleted: {
      type: Boolean,
      default: true,
    },
  },
  { versionKey: false }
);

// Indexes
QuizResultSchema.index({ userId: 1, completedAt: -1 });
QuizResultSchema.index({ quizMode: 1, subject: 1 });
QuizResultSchema.index({ score: -1 });

const QuizResult = mongoose.models.QuizResult || mongoose.model('QuizResult', QuizResultSchema);
export default QuizResult;



