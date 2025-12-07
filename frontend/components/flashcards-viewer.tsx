import { useState, useEffect } from "react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  RotateCcw, 
  ArrowLeft, 
  Grid3x3, 
  BookOpen, 
  CheckCircle, 
  Star, 
  Zap, 
  Target, 
  BarChart3,
  MoreVertical 
} from "lucide-react"
import apiFetch from "../utils/api"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface FlashcardsViewerProps {
  onNavigate: (page: string) => void
}

interface Flashcard {
  _id: string
  question: string
  answer: string
  hint?: string
  subject: string
  category: string
  difficulty: 'easy' | 'medium' | 'advanced'
  lastReviewDate?: string
  reviewCount: number
  masteryLevel: number
  tags: string[]
  examples?: string[]
  status: 'new' | 'learning' | 'review' | 'known' | 'mastered'
  isCurrent?: boolean
}

interface StudyProgress {
  masteryProgress: number
  knownCount: number
  masteredCount: number
  totalReviews: number
}

interface CardCategories {
  all: number
  review: number
  known: number
  mastered: number
}

export default function FlashcardsViewer({ onNavigate }: FlashcardsViewerProps) {
  const [currentCard, setCurrentCard] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [viewMode, setViewMode] = useState<"flip" | "grid">("flip")
  const [filter, setFilter] = useState<"all" | "known" | "review" | "mastered">("all")
  const [studyMode, setStudyMode] = useState<"standard" | "quick_review" | "exam_mode">("standard")
  const [showHint, setShowHint] = useState(false)
  const [autoFlip, setAutoFlip] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cards, setCards] = useState<Flashcard[]>([])
  const [studyProgress, setStudyProgress] = useState<StudyProgress>({
    masteryProgress: 0,
    knownCount: 0,
    masteredCount: 0,
    totalReviews: 0
  })
  const [cardCategories, setCardCategories] = useState<CardCategories>({
    all: 0,
    review: 0,
    known: 0,
    mastered: 0
  })
  const isMobile = useIsMobile()
  const cardHeightClass = isMobile ? "min-h-[320px]" : "min-h-[420px] lg:min-h-[480px]"

  // Constants
  const studyModes = [
    { id: "standard", label: "Standard", icon: BookOpen, color: "from-blue-500 to-cyan-500" },
    { id: "quick_review", label: "Quick Review", icon: Zap, color: "from-green-500 to-emerald-500" },
    { id: "exam_mode", label: "Exam Mode", icon: Target, color: "from-purple-500 to-pink-500" }
  ] as const

  const filters = [
    { id: "all", label: "All Cards" },
    { id: "review", label: "Review" },
    { id: "known", label: "Known" },
    { id: "mastered", label: "Mastered" }
  ] as const

  // Data fetching
  const fetchStudyData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch(`/api/flashcards/study-dashboard?filter=${filter}&mode=${studyMode}&limit=50`)

      if (data.success) {
        setCards(data.cards || [])
        setStudyProgress(data.studyProgress || { 
          masteryProgress: 0, 
          knownCount: 0, 
          masteredCount: 0, 
          totalReviews: 0 
        })
        setCardCategories(data.cardCategories || { 
          all: 0, 
          review: 0, 
          known: 0, 
          mastered: 0 
        })

        if (data.studySettings) {
          setAutoFlip(data.studySettings.autoFlip || false)
          setShowHint(data.studySettings.showHints !== false)
        }

        if (data.cards?.length > 0) {
          const currentIndex = data.cards.findIndex((card: Flashcard) => card.isCurrent)
          setCurrentCard(currentIndex >= 0 ? currentIndex : 0)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load flashcards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudyData()
  }, [filter, studyMode])

  // Settings management
  const updateSettings = async (newAutoFlip?: boolean, newShowHints?: boolean) => {
    try {
      await apiFetch('/api/flashcards/settings', {
        method: 'PUT',
        body: JSON.stringify({
          autoFlip: newAutoFlip ?? autoFlip,
          showHints: newShowHints ?? showHint
        })
      })
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  }

  // Auto-flip functionality
  useEffect(() => {
    if (autoFlip && isFlipped && cards.length > 0) {
      const timer = setTimeout(handleNext, 3000)
      return () => clearTimeout(timer)
    }
  }, [autoFlip, isFlipped, currentCard, cards.length])

  // Card navigation
  const handleNext = () => {
    setIsFlipped(false)
    setShowHint(false)
    if (cards.length > 0) {
      setCurrentCard((prev) => (prev + 1) % cards.length)
    }
  }

  const handlePrev = () => {
    setIsFlipped(false)
    setShowHint(false)
    if (cards.length > 0) {
      setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length)
    }
  }

  // Card actions
  const handleMarkKnown = async () => {
    if (cards.length === 0) return
    try {
      await apiFetch(`/api/flashcards/${cards[currentCard]._id}/mark-known`, { method: 'POST' })
      await fetchStudyData()
    } catch (err: any) {
      setError(err.message || 'Failed to mark card as known')
    }
  }

  const handleMarkMastered = async () => {
    if (cards.length === 0) return
    try {
      await apiFetch(`/api/flashcards/${cards[currentCard]._id}/mark-mastered`, { method: 'POST' })
      await fetchStudyData()
    } catch (err: any) {
      setError(err.message || 'Failed to mark card as mastered')
    }
  }

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setCurrentCard(0)
    setIsFlipped(false)
    setShowHint(false)
  }

  const handleReset = async () => {
    try {
      setIsFlipped(false)
      setShowHint(false)
      setAutoFlip(false)
      setCurrentCard(0)
      setError(null)
      await updateSettings(false, false)
      await fetchStudyData()
    } catch (err: any) {
      setError(err.message || 'Failed to reset progress')
    }
  }

  // UI helpers
  const getDifficultyColor = (difficulty: Flashcard['difficulty']) => {
    const colors = {
      easy: 'text-emerald-600 bg-emerald-100',
      medium: 'text-blue-600 bg-blue-100',
      advanced: 'text-red-600 bg-red-100'
    }
    return colors[difficulty] || colors.medium
  }

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 90) return 'text-emerald-600'
    if (mastery >= 70) return 'text-blue-600'
    if (mastery >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getStatusRing = (status: Flashcard['status']) => {
    const rings = {
      mastered: 'ring-2 ring-emerald-500',
      known: 'ring-2 ring-blue-500',
      new: '',
      learning: '',
      review: ''
    }
    return rings[status] || ''
  }

  // Stats calculations
  const stats: Record<keyof CardCategories, number> & { progress: number } = {
    all: cardCategories.all,
    known: cardCategories.known,
    mastered: cardCategories.mastered,
    review: cardCategories.review,
    progress: cards.length > 0 ? Math.round(((currentCard + 1) / cards.length) * 100) : 0
  }

  const currentCardData = cards[currentCard]

  // Grid View
  if (viewMode === "grid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-6">
            <button
              onClick={() => onNavigate("dashboard")}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium mb-6 transition-colors group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 mb-2">Flashcard Library</h1>
                <p className="text-slate-600">Browse and manage your study cards</p>
              </div>
              <button
                onClick={() => setViewMode("flip")}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center gap-2"
              >
                <BookOpen size={18} />
                Study Mode
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <div className="flex gap-3 flex-nowrap md:flex-wrap overflow-x-auto no-scrollbar -mx-2 px-2 md:mx-0 md:px-0 pb-1">
              {filters.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium whitespace-nowrap ${
                    filter === id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label} ({stats[id]})
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading flashcards...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchStudyData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
              {cards.map((card, index) => (
                <div
                  key={card._id}
                  className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 group ${getStatusRing(card.status)}`}
                  onClick={() => {
                    setViewMode("flip")
                    setCurrentCard(index)
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(card.difficulty)}`}>
                      {card.difficulty}
                    </span>
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Star size={14} className="text-yellow-500" />
                      <span className={getMasteryColor(card.masteryLevel)}>{card.masteryLevel}%</span>
                    </div>
                  </div>

                  <h3 className="font-semibold text-slate-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {card.question}
                  </h3>

                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{card.category || card.subject}</span>
                    <span>{card.reviewCount} reviews</span>
                  </div>

                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {card.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                      {card.tags.length > 2 && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          +{card.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Flip View
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-6">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium mb-6 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Flashcards Study</h1>
              <p className="text-slate-600">Active learning with spaced repetition</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("grid")}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2"
              >
                <Grid3x3 size={18} />
                Grid View
              </button>
              <button
                onClick={handleShuffle}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-700"
                title="Shuffle Cards"
              >
                <Shuffle size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Study Mode Selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {studyModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setStudyMode(mode.id)}
                    className={`flex-1 p-3 rounded-lg border transition-all duration-200 text-center ${
                      studyMode === mode.id
                        ? `bg-gradient-to-br ${mode.color} text-white border-transparent shadow-lg`
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <mode.icon size={18} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0 pb-1">
              {filters.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium whitespace-nowrap ${
                    filter === id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
                  }`}
                >
                  {label} ({stats[id]})
                </button>
              ))}
            </div>

            {/* Flashcard */}
            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading flashcards...</p>
              </div>
            ) : error ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={fetchStudyData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : cards.length > 0 ? (
              <div className="space-y-6">
                {/* Flashcard */}
                <div className="perspective-1200">
                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className={cn(
                      "relative w-full max-w-3xl mx-auto overflow-hidden rounded-2xl cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 shadow-2xl transition-transform duration-300 hover:-translate-y-0.5",
                      cardHeightClass
                    )}
                    aria-pressed={isFlipped}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 transition-transform duration-700 preserve-3d",
                        isFlipped ? "rotate-y-180" : "rotate-y-0"
                      )}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-white backface-hidden"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="text-center max-w-2xl">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                              {currentCardData?.category || currentCardData?.subject || 'General'}
                            </span>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm capitalize",
                              getDifficultyColor(currentCardData?.difficulty || 'medium')
                            )}>
                              {currentCardData?.difficulty || 'medium'}
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center leading-tight break-words">
                            {currentCardData?.question || 'No question available'}
                          </p>
                          {showHint && currentCardData?.hint && (
                            <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm text-balance break-words">
                              <p className="text-sm font-medium mb-2">Hint:</p>
                              <p className="text-sm opacity-90">{currentCardData.hint}</p>
                            </div>
                          )}
                          <p className="text-sm mt-6 opacity-75">
                            Click to reveal answer
                          </p>
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-green-600 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-white backface-hidden rotate-y-180"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <div className="text-center max-w-2xl">
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-center mb-6 leading-tight break-words">
                            {currentCardData?.question}
                          </p>
                          <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-6 break-words">
                            {currentCardData?.answer}
                          </p>
                          {currentCardData?.examples && currentCardData.examples.length > 0 && (
                            <div className="mb-6">
                              <p className="text-sm font-medium mb-2">Examples:</p>
                              {currentCardData.examples.map((example, index) => (
                                <p key={index} className="text-sm opacity-90 mb-1">• {example}</p>
                              ))}
                            </div>
                          )}
                          {currentCardData?.tags && currentCardData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                              {currentCardData.tags.map((tag, index) => (
                                <span key={index} className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur-sm">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-sm opacity-75">
                            Click to return to question
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                  <button
                    onClick={() => {
                      setShowHint(!showHint)
                      updateSettings(undefined, !showHint)
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-700 font-medium text-sm"
                  >
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </button>
                  <button
                    onClick={() => {
                      setAutoFlip(!autoFlip)
                      updateSettings(!autoFlip, undefined)
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
                      autoFlip
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    Auto-flip {autoFlip ? "On" : "Off"}
                  </button>
                </div>

                {/* Progress and Navigation */}
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                      <span>Card {currentCard + 1} of {cards.length}</span>
                      <span>{stats.progress}% Complete</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${stats.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                    <button
                      onClick={handlePrev}
                      className="p-4 bg-white rounded-2xl hover:shadow-lg transition-all duration-200 border border-slate-300 disabled:opacity-50"
                      disabled={cards.length === 0}
                    >
                      <ChevronLeft size={24} className="text-slate-700" />
                    </button>

                    <div className="flex-1 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleMarkKnown}
                        disabled={!currentCardData}
                        className={`flex-1 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                          currentCardData?.status === 'known'
                            ? "bg-emerald-500 text-white shadow-lg"
                            : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                        } disabled:opacity-50`}
                      >
                        <CheckCircle size={20} />
                        {currentCardData?.status === 'known' ? "✓ Known" : "Mark Known"}
                      </button>

                      <button
                        onClick={handleMarkMastered}
                        disabled={!currentCardData}
                        className={`flex-1 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                          currentCardData?.status === 'mastered'
                            ? "bg-purple-500 text-white shadow-lg"
                            : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                        } disabled:opacity-50`}
                      >
                        <Star size={20} />
                        {currentCardData?.status === 'mastered' ? "✓ Mastered" : "Master It"}
                      </button>
                    </div>

                    <button
                      onClick={handleNext}
                      className="p-4 bg-white rounded-2xl hover:shadow-lg transition-all duration-200 border border-slate-300 disabled:opacity-50"
                      disabled={cards.length === 0}
                    >
                      <ChevronRight size={24} className="text-slate-700" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <BookOpen size={48} className="mx-auto text-slate-400 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No cards available</h3>
                <p className="text-slate-600">Try changing your filter settings or add more flashcards.</p>
              </div>
            )}
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 size={18} />
                Study Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">Mastery Progress</span>
                    <span className="font-medium text-slate-900">{studyProgress.masteryProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${studyProgress.masteryProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600">{studyProgress.knownCount}</p>
                    <p className="text-xs text-slate-600">Known</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <p className="text-2xl font-bold text-emerald-600">{studyProgress.masteredCount}</p>
                    <p className="text-xs text-slate-600">Mastered</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Total Reviews</span>
                  <span className="font-medium">{studyProgress.totalReviews}</span>
                </div>
              </div>
            </div>

            {/* Study Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Study Settings</h3>
              <div className="space-y-3">
                <ToggleSwitch
                  label="Auto-flip cards"
                  checked={autoFlip}
                  onChange={(checked) => {
                    setAutoFlip(checked)
                    updateSettings(checked, undefined)
                  }}
                />
                <ToggleSwitch
                  label="Show hints"
                  checked={showHint}
                  onChange={(checked) => {
                    setShowHint(checked)
                    updateSettings(undefined, checked)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Toggle Switch Component
interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}></div>
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'transform translate-x-4' : ''
        }`}></div>
      </div>
    </label>
  )
}