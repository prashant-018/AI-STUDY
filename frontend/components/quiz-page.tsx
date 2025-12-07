import { useState, useEffect } from "react"
import { 
  ArrowLeft, 
  RotateCcw, 
  Clock, 
  Star, 
  Trophy, 
  Target, 
  Zap, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  FileText 
} from "lucide-react"
import apiFetch from "../utils/api"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface QuizPageProps {
  onNavigate: (page: string) => void
}

interface Question {
  id: number
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  timeLimit: number
}

interface QuizResult {
  score: number
  percentage: number
  correctAnswers: number
  totalQuestions: number
  timeSpent: number
  accuracy: number
  performance: 'excellent' | 'good' | 'average' | 'poor'
}

interface Note {
  _id: string
  title: string
  content: string
  subject?: string
  difficulty?: string
  tags?: string[]
}

export default function QuizPage({ onNavigate }: QuizPageProps) {
  const [quizStarted, setQuizStarted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(300)
  const [quizTime, setQuizTime] = useState(0)
  const [quizMode, setQuizMode] = useState<'practice' | 'timed' | 'exam'>('practice')
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [quizResults, setQuizResults] = useState<QuizResult | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const isMobile = useIsMobile()
  const optionBadgeSize = isMobile ? "w-8 h-8" : "w-10 h-10"

  // Constants
  const quizModes = [
    { 
      id: 'practice', 
      label: 'Practice Mode', 
      description: 'Learn at your own pace', 
      icon: BookOpen, 
      color: 'from-blue-500 to-cyan-500' 
    },
    { 
      id: 'timed', 
      label: 'Timed Challenge', 
      description: 'Test under time pressure', 
      icon: Clock, 
      color: 'from-purple-500 to-pink-500' 
    },
    { 
      id: 'exam', 
      label: 'Exam Simulation', 
      description: 'Real exam conditions', 
      icon: Zap, 
      color: 'from-orange-500 to-red-500' 
    }
  ] as const

  // Get questions from storage or use defaults
  const getQuestionsFromStorage = (): Question[] | null => {
    if (typeof window === 'undefined') return null
    
    const stored = sessionStorage.getItem('generatedQuizQuestions')
    if (!stored) return null

    try {
      const parsed = JSON.parse(stored)
      return parsed.map((q: any, index: number) => ({
        id: index + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        category: q.category || 'General',
        difficulty: q.difficulty || 'medium',
        timeLimit: q.timeLimit || 60,
      }))
    } catch (e) {
      console.error('Failed to parse stored questions:', e)
      return null
    }
  }

  const generatedQuestions = getQuestionsFromStorage()
  const quizTitle = typeof window !== 'undefined' 
    ? sessionStorage.getItem('generatedQuizTitle') || 'Knowledge Quiz' 
    : 'Knowledge Quiz'

  const defaultQuestions: Question[] = [
    {
      id: 1,
      question: "What is the primary function of mitochondria in eukaryotic cells?",
      options: [
        "Protein synthesis and modification",
        "Cellular respiration and ATP production",
        "DNA replication and transcription",
        "Lipid synthesis and storage"
      ],
      correctAnswer: 1,
      explanation: "Mitochondria are known as the powerhouse of the cell, responsible for cellular respiration and producing ATP.",
      category: "Cell Biology",
      difficulty: "medium",
      timeLimit: 60
    },
    {
      id: 2,
      question: "Which process accurately describes the mechanism of natural selection?",
      options: [
        "Organisms actively adapt to their environment",
        "Random mutations always benefit the species",
        "Traits that improve survival and reproduction become more common",
        "All individuals in a population evolve simultaneously"
      ],
      correctAnswer: 2,
      explanation: "Natural selection is the process where traits that enhance survival become more prevalent in a population.",
      category: "Evolution",
      difficulty: "hard",
      timeLimit: 75
    }
  ]

  const questions: Question[] = generatedQuestions || defaultQuestions

  // Clear stored questions when quiz completes
  useEffect(() => {
    if (quizResults && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        sessionStorage.removeItem('generatedQuizQuestions')
        sessionStorage.removeItem('generatedQuizTitle')
        sessionStorage.removeItem('generatedQuizSubject')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [quizResults])

  // Timer effects
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (quizStarted && timeLeft > 0 && !answered) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
        setQuizTime((prev) => prev + 1)
      }, 1000)
    } else if (timeLeft === 0 && !answered) {
      handleAutoAnswer()
    }
    return () => clearInterval(timer)
  }, [quizStarted, timeLeft, answered])

  // Quiz actions
  const handleStartQuiz = () => {
    setQuizStarted(true)
    setShowNotes(false)
    setTimeLeft(questions[currentQuestion].timeLimit)
    setScore(0)
    setCurrentQuestion(0)
    setQuizTime(0)
    setAnsweredQuestions(new Set())
    setQuizResults(null)
  }

  const handleViewNotes = async () => {
    setLoadingNotes(true)
    try {
      const categories = Array.from(new Set(questions.map(q => q.category)))
      const notesPromises = categories.map(category =>
        apiFetch(`/api/notes?subject=Biology&search=${encodeURIComponent(category)}`)
      )

      const notesResponses = await Promise.all(notesPromises)
      const allNotes: Note[] = []

      notesResponses.forEach(response => {
        if (response?.success && response?.notes) {
          allNotes.push(...response.notes)
        }
      })

      const uniqueNotes = allNotes.filter((note, index, self) =>
        index === self.findIndex(n => n._id === note._id)
      )

      setNotes(uniqueNotes)
      setShowNotes(true)
    } catch (error) {
      console.error('Error fetching notes:', error)
      setNotes([])
      setShowNotes(true)
    } finally {
      setLoadingNotes(false)
    }
  }

  const handleSelectAnswer = (index: number) => {
    if (!answered) {
      setSelectedAnswer(index)
      setAnswered(true)
      setAnsweredQuestions(prev => new Set([...prev, currentQuestion]))

      if (index === questions[currentQuestion].correctAnswer) {
        setScore((prev) => prev + 1)
      }
    }
  }

  const handleAutoAnswer = () => {
    if (!answered) {
      setSelectedAnswer(null)
      setAnswered(true)
      setAnsweredQuestions(prev => new Set([...prev, currentQuestion]))
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1)
      setSelectedAnswer(null)
      setAnswered(false)
      setTimeLeft(questions[currentQuestion + 1].timeLimit)
    } else {
      calculateResults()
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1)
      setSelectedAnswer(null)
      setAnswered(answeredQuestions.has(currentQuestion - 1))
    }
  }

  const calculateResults = () => {
    const percentage = (score / questions.length) * 100
    const accuracy = (score / answeredQuestions.size) * 100
    let performance: QuizResult['performance'] = 'poor'

    if (percentage >= 90) performance = 'excellent'
    else if (percentage >= 70) performance = 'good'
    else if (percentage >= 50) performance = 'average'

    setQuizResults({
      score,
      percentage,
      correctAnswers: score,
      totalQuestions: questions.length,
      timeSpent: quizTime,
      accuracy,
      performance
    })
  }

  const handleRetake = () => {
    handleStartQuiz()
  }

  // UI helpers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getDifficultyColor = (difficulty: Question['difficulty']) => {
    const colors = {
      easy: 'text-emerald-600 bg-emerald-100',
      medium: 'text-blue-600 bg-blue-100',
      hard: 'text-red-600 bg-red-100'
    }
    return colors[difficulty]
  }

  const getPerformanceColor = (performance: QuizResult['performance']) => {
    const colors = {
      excellent: 'from-emerald-500 to-green-500',
      good: 'from-blue-500 to-cyan-500',
      average: 'from-orange-500 to-amber-500',
      poor: 'from-red-500 to-pink-500'
    }
    return colors[performance]
  }

  const currentQuestionData = questions[currentQuestion]
  const isCorrect = selectedAnswer === currentQuestionData?.correctAnswer
  const progress = ((currentQuestion + 1) / questions.length) * 100
  const isQuizComplete = quizResults !== null

  // Notes view before quiz starts
  if (showNotes && !quizStarted) {
    const categories = Array.from(new Set(questions.map(q => q.category)))

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <button
                onClick={() => setShowNotes(false)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium transition-colors group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back to Quiz
              </button>
              <h2 className="text-2xl font-bold text-slate-900">Study Notes</h2>
              <div className="sm:w-24" />
            </div>

            {/* Quiz Topics */}
            <div className="bg-blue-50 rounded-xl p-5 sm:p-6 mb-8 border border-blue-200">
              <h3 className="font-bold text-slate-900 mb-3">Quiz Topics Covered:</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <span
                    key={category}
                    className="px-3 py-1 bg-white text-slate-700 rounded-full text-sm font-medium border border-slate-300"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>

            {/* Notes List */}
            {loadingNotes ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-slate-600">Loading notes...</p>
              </div>
            ) : notes.length > 0 ? (
              <div className="space-y-4 mb-8 max-h-[60vh] overflow-y-auto pr-1">
                {notes.map((note) => (
                  <div
                    key={note._id}
                    className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-slate-900 mb-2">{note.title}</h4>
                        {note.subject && (
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium mr-2">
                            {note.subject}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-slate-700 whitespace-pre-wrap">
                      {note.content.length > 300 ? `${note.content.substring(0, 300)}...` : note.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 mb-8">
                <FileText size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 text-lg mb-2">No notes found for these topics</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200">
              <button
                onClick={() => setShowNotes(false)}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleStartQuiz}
                className="flex-1 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-all font-semibold text-lg flex items-center justify-center gap-3"
              >
                <Zap size={24} />
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Quiz start screen
  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:p-8 flex items-center justify-center">
        <div className="max-w-4xl w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-10">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium mb-6 sm:mb-8 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className="text-center mb-10 sm:mb-12">
            <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4">{quizTitle}</h1>
            <p className="text-lg sm:text-xl text-slate-600 mb-2">
              {generatedQuestions ? 'Quiz generated from your notes' : 'Test your knowledge'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-slate-500 text-sm sm:text-base">
              <span className="flex items-center gap-2">
                <BookOpen size={18} />
                {questions.length} questions
              </span>
              <span className="flex items-center gap-2">
                <Clock size={18} />
                {Math.ceil(questions.reduce((acc, q) => acc + q.timeLimit, 0) / 60)} minutes
              </span>
            </div>
          </div>

          {/* Quiz Modes */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:overflow-visible mb-10 sm:mb-12">
            {quizModes.map(({ id, label, description, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setQuizMode(id)}
                className={cn(
                  "p-4 sm:p-6 rounded-2xl border-2 transition-all duration-300 text-left min-w-[220px]",
                  quizMode === id
                    ? `bg-gradient-to-br ${color} text-white border-transparent shadow-xl scale-[1.02]`
                    : "bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:shadow-lg"
                )}
              >
                <Icon size={32} className="mb-4" />
                <h3 className="font-bold text-lg mb-2">{label}</h3>
                <p className="text-sm opacity-80">{description}</p>
              </button>
            ))}
          </div>

          {/* Quiz Overview */}
          <div className="bg-blue-50 rounded-2xl p-6 sm:p-8 mb-8 border border-blue-200">
            <h3 className="font-bold text-slate-900 mb-4">Quiz Overview</h3>
            <div className="grid gap-6 text-sm sm:grid-cols-2">
              <div>
                <p className="font-semibold text-slate-700 mb-2">Topics Covered:</p>
                <ul className="text-slate-600 space-y-1">
                  {Array.from(new Set(questions.map(q => q.category))).map(category => (
                    <li key={category} className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500" />
                      {category}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-2">Difficulty:</p>
                <div className="space-y-2">
                  {['easy', 'medium', 'hard'].map(diff => {
                    const count = questions.filter(q => q.difficulty === diff).length
                    return (
                      <div key={diff} className="flex items-center justify-between">
                        <span className="text-slate-600 capitalize">{diff}</span>
                        <span className="font-semibold text-slate-700">{count} questions</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleViewNotes}
              className="flex-1 bg-emerald-600 text-white px-8 py-4 rounded-xl hover:bg-emerald-700 transition-all font-semibold text-lg flex items-center justify-center gap-3"
            >
              <FileText size={24} />
              View Notes
            </button>
            <button
              onClick={handleStartQuiz}
              className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all font-semibold text-lg flex items-center justify-center gap-3"
            >
              <Zap size={24} />
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Results screen
  if (isQuizComplete && quizResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:p-8 flex items-center justify-center">
        <div className="max-w-4xl w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-10">
          <div className="text-center mb-10 sm:mb-12">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trophy size={40} className="text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Quiz Complete!</h1>
            <p className="text-slate-600 text-base sm:text-lg">
              {quizResults.performance === 'excellent' && "Outstanding performance! 🎉"}
              {quizResults.performance === 'good' && "Great job! You have a solid understanding. 👍"}
              {quizResults.performance === 'average' && "Good effort! Review the material for improvement. 📚"}
              {quizResults.performance === 'poor' && "Keep practicing! You'll get better with more study. 💪"}
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10 sm:mb-12">
            {[
              { label: "Score", value: `${Math.round(quizResults.percentage)}%`, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Correct", value: quizResults.correctAnswers, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Time Spent", value: formatTime(quizResults.timeSpent), color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Accuracy", value: `${Math.round(quizResults.accuracy)}%`, color: "text-orange-600", bg: "bg-orange-50" }
            ].map((stat, index) => (
              <div key={index} className={`${stat.bg} rounded-2xl p-5 sm:p-6 text-center`}>
                <p className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</p>
                <p className="text-slate-600 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleRetake}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 transition-all font-semibold flex items-center justify-center gap-3"
            >
              <RotateCcw size={20} />
              Retake Quiz
            </button>
            <button
              onClick={() => onNavigate("dashboard")}
              className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-xl hover:bg-slate-200 transition-all font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active quiz screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Exit Quiz
          </button>

          <div className="grid grid-cols-3 gap-4 sm:gap-6 w-full sm:w-auto">
            <div className="text-center px-2">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Question</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                {currentQuestion + 1}<span className="text-slate-400">/{questions.length}</span>
              </p>
            </div>

            <div className="text-center px-2">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Time Left</p>
              <p className={cn(
                "text-xl sm:text-2xl font-bold",
                timeLeft < 30 ? "text-red-600 animate-pulse" : "text-blue-600"
              )}>
                {formatTime(timeLeft)}
              </p>
            </div>

            <div className="text-center px-2">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Score</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">{score}</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-full h-3 shadow-sm border border-slate-200">
          <div
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 sm:p-8">
          {/* Question Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-medium capitalize",
                getDifficultyColor(currentQuestionData.difficulty)
              )}>
                {currentQuestionData.difficulty}
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                {currentQuestionData.category}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              Time limit: {formatTime(currentQuestionData.timeLimit)}
            </div>
          </div>

          {/* Question */}
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 mb-6 sm:mb-8 leading-tight">
            {currentQuestionData.question}
          </h2>

          {/* Options */}
          <div className="space-y-3 sm:space-y-4">
            {currentQuestionData.options.map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrectAnswer = index === currentQuestionData.correctAnswer

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={answered}
                  className={cn(
                    "w-full text-left rounded-xl border-2 transition-all duration-300 font-medium text-base sm:text-lg p-4 sm:p-6",
                    !answered
                      ? "border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md"
                      : isCorrectAnswer
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                        : isSelected
                          ? "border-red-500 bg-red-50 text-red-900 shadow-sm"
                          : "border-slate-300 text-slate-700"
                  )}
                >
                  <div className="flex items-start sm:items-center">
                    <span className={cn(
                      "inline-flex items-center justify-center rounded-lg border-2 mr-4 font-semibold transition-colors flex-shrink-0",
                      optionBadgeSize,
                      !answered
                        ? "border-slate-300 text-slate-700"
                        : isCorrectAnswer
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isSelected
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-slate-300 text-slate-500"
                    )}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1 leading-relaxed">{option}</span>
                    {answered && isCorrectAnswer && (
                      <CheckCircle size={20} className="text-emerald-500 ml-2" />
                    )}
                    {answered && isSelected && !isCorrectAnswer && (
                      <XCircle size={20} className="text-red-500 ml-2" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Explanation */}
          {answered && (
            <div className={`mt-8 p-6 rounded-xl border-2 transition-all duration-300 ${
              isCorrect ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isCorrect ? 'bg-emerald-500' : 'bg-red-500'
                }`}>
                  {isCorrect ? <CheckCircle size={16} className="text-white" /> : <XCircle size={16} className="text-white" />}
                </div>
                <h3 className="font-bold text-lg">
                  {isCorrect ? "Correct!" : "Incorrect"}
                </h3>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {currentQuestionData.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestion === 0}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold disabled:opacity-50 flex items-center gap-2 justify-center"
          >
            <ArrowLeft size={18} />
            Previous
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
            <span className="text-sm text-slate-600 whitespace-nowrap">
              {answeredQuestions.size} of {questions.length} answered
            </span>
            <button
              onClick={handleNextQuestion}
              disabled={!answered}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold disabled:opacity-50 flex items-center gap-2 justify-center"
            >
              {currentQuestion === questions.length - 1 ? "Finish Quiz" : "Next Question"}
              <ArrowLeft size={18} className="rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}