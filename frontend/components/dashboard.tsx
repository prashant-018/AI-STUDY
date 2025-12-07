import { LogOut, Search, Settings, User, Sparkles, Upload, Grid2x2, FileText, ChevronRight, TrendingUp, BookOpen, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import Notifications from "./notifications"
import { activityApi, dashboardApi, getAuthToken } from "@/utils/api"

interface DashboardProps {
  onNavigate: (page: string) => void
  onLogout: () => void
}

interface QuickAction {
  icon: React.ComponentType<any>
  label: string
  description: string
  action: string
  color: string
  bgColor: string
}

interface RecentNote {
  id: string
  title: string
  timeLabel: string
  subject: string
  progress?: number
  type: 'notes' | 'quiz' | 'flashcards'
}

interface ApiActivity {
  id?: string
  _id?: string
  type: string
  subject?: string | null
  topic?: string | null
  score?: number | null
  timeAgo?: string
  details?: Record<string, any>
}

interface StreakData {
  currentStreak: number
  bestStreak: number
}

interface DashboardMetricCard {
  value: number | string
  change: number
  trend: 'up' | 'down'
}

interface DashboardMetrics {
  totalNotes?: DashboardMetricCard
  quizzesCompleted?: DashboardMetricCard
  averageScore?: DashboardMetricCard
  studyHours?: DashboardMetricCard
  lastStudySession?: string | null
}

const ACTIVITY_TYPE_TO_CARD: Record<string, RecentNote['type']> = {
  quiz: "quiz",
  flashcard: "flashcards",
  summary: "notes",
  note: "notes",
  study_session: "notes"
}

const getDefaultSubjectLabel = (type: RecentNote['type']) => {
  if (type === "quiz") return "Quiz"
  if (type === "flashcards") return "Flashcards"
  return "Study Session"
}

const buildActivityTitle = (activity: ApiActivity, subject: string) => {
  if (activity.topic) return activity.topic
  if (activity.subject) return activity.subject
  switch (activity.type) {
    case "quiz":
      return "Completed Quiz"
    case "flashcard":
      return "Flashcard Review"
    case "summary":
      return "Generated Summary"
    case "study_session":
      return "Study Session"
    default:
      return subject
  }
}

const mapActivityToRecentNote = (activity: ApiActivity): RecentNote => {
  const cardType = ACTIVITY_TYPE_TO_CARD[activity.type] || "notes"
  const subject = activity.subject || getDefaultSubjectLabel(cardType)
  const progressFromScore = typeof activity.score === "number" ? Math.round(activity.score) : undefined
  const progressFromDetails = typeof activity.details?.progress === "number"
    ? Math.round(activity.details.progress)
    : undefined

  return {
    id: activity.id || activity._id || `${activity.type}-${Math.random().toString(36).slice(2, 8)}`,
    title: buildActivityTitle(activity, subject),
    subject,
    timeLabel: activity.timeAgo || "Just now",
    progress: progressFromScore ?? progressFromDetails,
    type: cardType
  }
}

interface StatCard {
  label: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: React.ComponentType<any>
  color: string
}

interface UpcomingSession {
  title: string
  scheduledAt?: string
  timeLabel: string
  subject?: string
  type?: string
  id?: string
  source?: 'suggested' | 'custom'
}

interface WeeklyPerformance {
  studyTime: {
    value: number
    unit: string
    total: number
    percentage: number
  }
  quizzesPassed: {
    passed: number
    total: number
    percentage: number
  }
  notesReviewed: {
    reviewed: number
    total: number
    percentage: number
  }
}

export default function Dashboard({ onNavigate, onLogout }: DashboardProps) {
  const { user } = useAuth() as any
  const [searchQuery, setSearchQuery] = useState("")
  const [activeView, setActiveView] = useState<'overview' | 'recent'>('overview')
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)
  const [streakData, setStreakData] = useState<StreakData>({ currentStreak: 0, bestStreak: 0 })
  const [streakLoading, setStreakLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([])
  const [upcomingLoading, setUpcomingLoading] = useState(true)
  const [upcomingError, setUpcomingError] = useState<string | null>(null)
  const [weeklyPerformance, setWeeklyPerformance] = useState<WeeklyPerformance | null>(null)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [performanceError, setPerformanceError] = useState<string | null>(null)
  const [customSessions, setCustomSessions] = useState<UpcomingSession[]>([])
  const [isAddingSession, setIsAddingSession] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState("")
  const [newSessionDate, setNewSessionDate] = useState("")
  const userId = user?._id || user?.id

  // Get user info from AuthContext or use default
  const userName = user?.name || "Alex Johnson"
  const userEmail = user?.email || ""
  const userPicture = user?.picture || null
  const userRole = user?.role || "Student"

  const quickActions: QuickAction[] = [
    {
      icon: Upload,
      label: "Upload Notes",
      description: "Upload and organize your study materials",
      action: "upload",
      color: "from-purple-600 to-indigo-600",
      bgColor: "bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200"
    },
    {
      icon: Sparkles,
      label: "AI Summary",
      description: "Generate smart summaries from your notes",
      action: "summary",
      color: "from-blue-600 to-cyan-600",
      bgColor: "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200"
    },
    {
      icon: Grid2x2,
      label: "Flashcards",
      description: "Create and study with AI-powered cards",
      action: "flashcards",
      color: "from-emerald-600 to-green-600",
      bgColor: "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200"
    },
    {
      icon: FileText,
      label: "Take Quiz",
      description: "Test your knowledge with adaptive quizzes",
      action: "quiz",
      color: "from-orange-600 to-red-600",
      bgColor: "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200"
    },
  ]

  const statConfigs: Array<StatCard & { key: keyof DashboardMetrics; suffix?: string; decimals?: number }> = [
    { key: "totalNotes", label: "Total Notes", value: "", change: "", trend: 'up', icon: BookOpen, color: "text-purple-600" },
    { key: "quizzesCompleted", label: "Quizzes Completed", value: "", change: "", trend: 'up', icon: FileText, color: "text-blue-600" },
    { key: "averageScore", label: "Average Score", value: "", change: "", trend: 'up', icon: TrendingUp, color: "text-emerald-600", suffix: "%", decimals: 0 },
    { key: "studyHours", label: "Study Hours", value: "", change: "", trend: 'up', icon: Clock, color: "text-orange-600", suffix: "h", decimals: 1 },
  ]

  const formatDayLabel = (value: number) => `${value} day${value === 1 ? '' : 's'}`
  const formatMetricValue = (value: number | string | undefined, suffix = "", decimals?: number) => {
    if (value === undefined || value === null) return `0${suffix}`
    if (typeof value === "number") {
      const formatted = typeof decimals === "number" ? value.toFixed(decimals) : value
      return `${formatted}${suffix}`
    }
    return `${value}${suffix}`
  }

  useEffect(() => {
    let isMounted = true

    const loadActivities = async () => {
      if (!userId) {
        setRecentNotes([])
        setActivitiesLoading(false)
        return
      }

      setActivitiesLoading(true)
      setActivitiesError(null)
      try {
        const response = await activityApi.getRecent(5)
        if (!isMounted) return
        const activities = Array.isArray(response?.activities) ? response.activities : []
        setRecentNotes(activities.map(mapActivityToRecentNote))
      } catch (error: any) {
        if (!isMounted) return
        console.error("Failed to fetch recent activity:", error)
        setRecentNotes([])
        setActivitiesError(error?.message || "Failed to load recent activity.")
      } finally {
        if (isMounted) {
          setActivitiesLoading(false)
        }
      }
    }

    const loadMetrics = async () => {
      if (!userId) {
        setMetrics(null)
        setMetricsLoading(false)
        return
      }

      setMetricsLoading(true)
      setMetricsError(null)
      try {
        const response = await dashboardApi.getMetrics()
        if (!isMounted) return
        setMetrics(response?.metrics || null)
      } catch (error: any) {
        if (!isMounted) return
        console.error("Failed to fetch dashboard metrics:", error)
        setMetrics(null)
        setMetricsError(error?.message || "Failed to load dashboard metrics.")
      } finally {
        if (isMounted) {
          setMetricsLoading(false)
        }
      }
    }

    const loadUpcoming = async () => {
      if (!userId) {
        setUpcomingSessions([])
        setUpcomingLoading(false)
        return
      }

      setUpcomingLoading(true)
      setUpcomingError(null)
      try {
        const response = await dashboardApi.getUpcomingSessions()
        if (!isMounted) return
        setUpcomingSessions(Array.isArray(response?.sessions) ? response.sessions : [])
      } catch (error: any) {
        if (!isMounted) return
        console.error("Failed to fetch upcoming sessions:", error)
        setUpcomingSessions([])
        setUpcomingError(error?.message || "Failed to load upcoming sessions.")
      } finally {
        if (isMounted) setUpcomingLoading(false)
      }
    }

    const loadWeeklyPerformance = async () => {
      if (!userId) {
        setWeeklyPerformance(null)
        setPerformanceLoading(false)
        return
      }

      setPerformanceLoading(true)
      setPerformanceError(null)
      try {
        const response = await dashboardApi.getWeeklyPerformance()
        if (!isMounted) return
        setWeeklyPerformance(response?.performance || null)
      } catch (error: any) {
        if (!isMounted) return
        console.error("Failed to fetch weekly performance:", error)
        setWeeklyPerformance(null)
        setPerformanceError(error?.message || "Failed to load weekly performance.")
      } finally {
        if (isMounted) setPerformanceLoading(false)
      }
    }

    const loadCustomSessions = () => {
      if (typeof window === "undefined" || !userId) {
        setCustomSessions([])
        return
      }
      try {
        const stored = localStorage.getItem(`studyai-custom-sessions-${userId}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          setCustomSessions(Array.isArray(parsed) ? parsed : [])
        } else {
          setCustomSessions([])
        }
      } catch (error) {
        console.warn("Failed to load custom sessions", error)
        setCustomSessions([])
      }
    }

    const loadStreak = async () => {
      if (!userId) {
        setStreakData({ currentStreak: 0, bestStreak: 0 })
        setStreakLoading(false)
        return
      }

      setStreakLoading(true)
      try {
        const response = await activityApi.getStreak()
        if (!isMounted) return
        setStreakData({
          currentStreak: response?.streak?.currentStreak || 0,
          bestStreak: response?.streak?.bestStreak || 0
        })
      } catch (error) {
        if (!isMounted) return
        console.error("Failed to fetch streak:", error)
        setStreakData({ currentStreak: 0, bestStreak: 0 })
      } finally {
        if (isMounted) {
          setStreakLoading(false)
        }
      }
    }

    if (userId) {
      loadActivities()
      loadStreak()
      loadMetrics()
      loadUpcoming()
      loadWeeklyPerformance()
      loadCustomSessions()
    } else {
      setActivitiesLoading(false)
      setStreakLoading(false)
      setMetricsLoading(false)
      setUpcomingLoading(false)
      setPerformanceLoading(false)
      setCustomSessions([])
    }

    return () => {
      isMounted = false
    }
  }, [userId])

  const currentStreakLabel = streakLoading ? "—" : formatDayLabel(streakData.currentStreak)
  const bestStreakLabel = streakLoading ? "—" : formatDayLabel(streakData.bestStreak)
  const streakMessage = streakLoading
    ? "Checking your progress..."
    : streakData.currentStreak > 0
      ? "Keep the momentum going!"
      : "Complete a study session to start building a streak."
  const lastStudySessionLabel = metricsLoading
    ? "Fetching latest session..."
    : metrics?.lastStudySession || "No sessions yet"

  const resolvedStats = statConfigs.map((config) => {
    const metric = metrics?.[config.key] as DashboardMetricCard | undefined
    const value = metricsLoading
      ? "—"
      : formatMetricValue(metric?.value, config.suffix, config.decimals)
    const change = metric
      ? `${metric.change >= 0 ? '+' : ''}${metric.change}%`
      : metricsLoading
        ? ''
        : '0%'
    const trend = metric?.trend ?? 'up'

    return {
      ...config,
      value,
      change,
      trend
    }
  })

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-emerald-500"
    if (progress >= 60) return "bg-blue-500"
    return "bg-orange-500"
  }

  const getTypeIcon = (type: RecentNote['type']) => {
    switch (type) {
      case 'quiz': return <FileText size={16} className="text-blue-600" />
      case 'flashcards': return <Grid2x2 size={16} className="text-emerald-600" />
      default: return <BookOpen size={16} className="text-purple-600" />
    }
  }

interface PerformanceRowProps {
  label: string
  primary: string
  secondary?: string
  percentage: number
  barColor: string
}

function PerformanceRow({ label, primary, secondary, percentage, barColor }: PerformanceRowProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <div>
          <span className="text-slate-700">{label}</span>
          {secondary && <p className="text-xs text-slate-500">{secondary}</p>}
        </div>
        <span className="font-medium text-slate-900">{primary}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        ></div>
      </div>
    </div>
  )
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Enhanced Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 md:gap-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              StudyAI
            </div>
          </div>

          {/* Enhanced Search */}
          <div className="order-3 w-full md:order-none md:flex-1 md:w-auto">
            <div className="relative w-full">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search notes, subjects, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-100/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all duration-200 placeholder-slate-500 text-sm"
              />
            </div>
          </div>

          {/* Enhanced User Menu */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Notifications token={getAuthToken() || undefined} />

            <button className="p-2.5 hover:bg-slate-100 rounded-xl transition-all duration-200 group">
              <Settings size={20} className="text-slate-700 group-hover:text-slate-900" />
            </button>

            <div className="flex items-center gap-2 sm:gap-3 pl-3 border-l border-slate-200">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-all duration-200 cursor-pointer">
                {userPicture ? (
                  <img
                    src={userPicture}
                    alt={userName}
                    className="w-9 h-9 rounded-full object-cover shadow-sm border-2 border-white"
                  />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <User size={18} className="text-white" />
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">{userName}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[160px]">{userEmail || userRole}</p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2.5 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900 group"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Enhanced Welcome Section */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Welcome back, {userName.split(' ')[0]}!</h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl">
                Ready to continue your learning journey? You're making great progress this week.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-white rounded-xl px-4 py-2 border border-slate-200 w-full lg:w-auto">
              <Clock size={16} className="text-purple-500" />
              <span className="truncate">Last study session: {lastStudySessionLabel}</span>
            </div>
          </div>

          {/* Stats Overview */}
          {metricsError && (
            <p className="text-sm text-red-500 mb-2">{metricsError}</p>
          )}
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
            <div className="min-w-[600px] grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {resolvedStats.map((stat) => (
                <div key={stat.label} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-sm text-slate-600 mt-1">{stat.label}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50">
                      <stat.icon size={20} className={stat.color} />
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium mt-2 ${stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                    <TrendingUp size={14} className={stat.trend === 'down' ? 'rotate-180' : ''} />
                    <span>{metricsLoading ? 'Updating...' : stat.change}</span>
                    {!metricsLoading && <span>from last week</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Quick Actions */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Quick Actions</h2>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Frequently used tools</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onNavigate(action.action)}
                className={`${action.bgColor} border p-6 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 group text-left`}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <action.icon size={24} className="text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2 text-lg">{action.label}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{action.description}</p>
                <div className="flex items-center text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                  <span>Get started</span>
                  <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enhanced Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <h2 className="text-2xl font-bold text-slate-900">Recent Activity</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveView('overview')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'overview'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveView('recent')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'recent'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Recent
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-1 min-h-[120px]">
                {activitiesLoading ? (
                  <div className="p-6 text-center text-slate-500 text-sm">Loading recent activity...</div>
                ) : activitiesError ? (
                  <div className="p-6 text-center text-red-500 text-sm">{activitiesError}</div>
                ) : recentNotes.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    No recent activity yet. Complete a study session, quiz, or upload notes to start tracking.
                  </div>
                ) : (
                  recentNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-all duration-200 group cursor-pointer rounded-xl mx-2 my-1"
                      onClick={() => onNavigate(note.type)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors">
                          {getTypeIcon(note.type)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 group-hover:text-slate-800">{note.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-slate-600">{note.subject}</span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-sm text-slate-500">{note.timeLabel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {typeof note.progress === "number" && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressColor(note.progress)} transition-all duration-500`}
                                style={{ width: `${note.progress}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-700 w-8">{note.progress}%</span>
                          </div>
                        )}
                        <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Study Streak */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Current Streak</p>
                  <p className="text-3xl font-bold mt-1">{currentStreakLabel}</p>
                </div>
                <div className="text-3xl">🔥</div>
              </div>
              <div className="text-orange-100 text-sm space-y-1">
                <p>Best streak: {bestStreakLabel}</p>
                <p>{streakMessage}</p>
              </div>
            </div>

            {/* Upcoming Study Sessions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Upcoming Sessions</h3>
                <button
                  onClick={() => setIsAddingSession(prev => !prev)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {isAddingSession ? "Cancel" : "Add Task"}
                </button>
              </div>

              {isAddingSession && (
                <form
                  className="space-y-3 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newSessionTitle.trim() || !newSessionDate) return
                    const date = new Date(newSessionDate)
                    const timeLabel = date.toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit"
                    })
                    const sessionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                      ? crypto.randomUUID()
                      : Math.random().toString(36).slice(2, 9)
                    const newSession: UpcomingSession = {
                      id: sessionId,
                      title: newSessionTitle.trim(),
                      scheduledAt: date.toISOString(),
                      timeLabel,
                      subject: newSessionTitle.trim(),
                      source: 'custom'
                    }
                    setCustomSessions(prev => {
                      const updated = [newSession, ...prev]
                      if (typeof window !== "undefined" && userId) {
                        localStorage.setItem(`studyai-custom-sessions-${userId}`, JSON.stringify(updated))
                      }
                      return updated
                    })
                    setNewSessionTitle("")
                    setNewSessionDate("")
                    setIsAddingSession(false)
                  }}
                >
                  <input
                    type="text"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    placeholder="Session title"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="datetime-local"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white text-sm font-semibold rounded-lg py-2 hover:bg-blue-700 transition-colors"
                  >
                    Save Session
                  </button>
                </form>
              )}

              {upcomingLoading ? (
                <p className="text-sm text-slate-500">Loading sessions...</p>
              ) : upcomingError ? (
                <p className="text-sm text-red-500">{upcomingError}</p>
              ) : [...customSessions, ...upcomingSessions].length === 0 ? (
                <div className="text-sm text-slate-500">
                  No sessions scheduled yet. Start a study session or quiz to generate recommendations.
                </div>
              ) : (
                <div className="space-y-4">
                  {[...customSessions, ...upcomingSessions].map((session, index) => (
                    <div
                      key={session.id || `${session.title}-${index}`}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-slate-900 capitalize">{session.title}</p>
                        <p className="text-sm text-slate-600">{session.timeLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.source === 'custom' && (
                          <button
                            onClick={() => {
                              setCustomSessions(prev => {
                                const updated = prev.filter(s => s.id !== session.id)
                                if (typeof window !== "undefined" && userId) {
                                  localStorage.setItem(`studyai-custom-sessions-${userId}`, JSON.stringify(updated))
                                }
                                return updated
                              })
                            }}
                            className="text-xs text-slate-500 hover:text-red-500"
                          >
                            Remove
                          </button>
                        )}
                        <div className={`w-2 h-2 rounded-full ${session.source === 'custom' ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Metrics */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Weekly Performance</h3>
              {performanceLoading ? (
                <p className="text-sm text-slate-500">Calculating performance…</p>
              ) : performanceError ? (
                <p className="text-sm text-red-500">{performanceError}</p>
              ) : !weeklyPerformance ? (
                <div className="text-sm text-slate-500">
                  Complete study sessions, quizzes, or review notes to see performance insights.
                </div>
              ) : (
                <div className="space-y-3">
                  <PerformanceRow
                    label="Study Time"
                    primary={`${weeklyPerformance.studyTime.value}${weeklyPerformance.studyTime.unit}`}
                    secondary={`Goal: ${weeklyPerformance.studyTime.total}${weeklyPerformance.studyTime.unit}`}
                    percentage={weeklyPerformance.studyTime.percentage}
                    barColor="bg-blue-600"
                  />
                  <PerformanceRow
                    label="Quizzes Passed"
                    primary={`${weeklyPerformance.quizzesPassed.passed}/${weeklyPerformance.quizzesPassed.total || 1}`}
                    secondary={`${weeklyPerformance.quizzesPassed.percentage}% success`}
                    percentage={weeklyPerformance.quizzesPassed.percentage}
                    barColor="bg-emerald-600"
                  />
                  <PerformanceRow
                    label="Notes Reviewed"
                    primary={`${weeklyPerformance.notesReviewed.reviewed}/${weeklyPerformance.notesReviewed.total || 1}`}
                    secondary={`${weeklyPerformance.notesReviewed.percentage}% of total`}
                    percentage={weeklyPerformance.notesReviewed.percentage}
                    barColor="bg-purple-600"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}