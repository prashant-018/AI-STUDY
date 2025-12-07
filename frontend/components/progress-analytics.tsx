import { ArrowLeft, Download, Calendar, TrendingUp, Target, Award, Clock, BookOpen, BarChart3, MoreVertical, Filter, Eye, Share2 } from "lucide-react"
import { useState } from "react"

interface ProgressAnalyticsProps {
  onNavigate: (page: string) => void
}

interface AnalyticsData {
  date: string
  studyTime: number
  notesAdded: number
  quizzesCompleted: number
  avgScore: number
}

interface SubjectPerformance {
  subject: string
  score: number
  improvement: number
  studyTime: number
  totalNotes: number
  color: string
  trend: 'up' | 'down'
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  progress?: number
  dateUnlocked?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export default function ProgressAnalytics({ onNavigate }: ProgressAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "90days" | "1year">("30days")
  const [activeMetric, setActiveMetric] = useState<"studyTime" | "performance" | "productivity">("performance")
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)

  const stats = [
    { 
      label: "Total Study Time", 
      value: "147.2h", 
      icon: Clock, 
      change: "+12.5h", 
      trend: "up" as const,
      description: "Time spent learning this month"
    },
    { 
      label: "Notes Uploaded", 
      value: "42", 
      icon: BookOpen, 
      change: "+8", 
      trend: "up" as const,
      description: "Study materials added"
    },
    { 
      label: "Quizzes Completed", 
      value: "28", 
      icon: Target, 
      change: "+5", 
      trend: "up" as const,
      description: "Assessments finished"
    },
    { 
      label: "Mastery Level", 
      value: "87%", 
      icon: Award, 
      change: "+3.2%", 
      trend: "up" as const,
      description: "Overall proficiency score"
    },
  ]

  const analyticsData: AnalyticsData[] = [
    { date: "Jan 1", studyTime: 4.2, notesAdded: 3, quizzesCompleted: 2, avgScore: 82 },
    { date: "Jan 2", studyTime: 3.8, notesAdded: 2, quizzesCompleted: 1, avgScore: 78 },
    { date: "Jan 3", studyTime: 5.1, notesAdded: 4, quizzesCompleted: 3, avgScore: 85 },
    { date: "Jan 4", studyTime: 2.9, notesAdded: 1, quizzesCompleted: 2, avgScore: 76 },
    { date: "Jan 5", studyTime: 6.2, notesAdded: 5, quizzesCompleted: 4, avgScore: 91 },
    { date: "Jan 6", studyTime: 4.7, notesAdded: 3, quizzesCompleted: 2, avgScore: 88 },
    { date: "Jan 7", studyTime: 5.5, notesAdded: 4, quizzesCompleted: 3, avgScore: 84 },
  ]

  const subjectPerformance: SubjectPerformance[] = [
    { subject: "Biology", score: 88, improvement: 5.2, studyTime: 42.5, totalNotes: 18, color: "from-purple-500 to-purple-600", trend: 'up' },
    { subject: "Physics", score: 82, improvement: 2.8, studyTime: 38.2, totalNotes: 12, color: "from-blue-500 to-blue-600", trend: 'up' },
    { subject: "Chemistry", score: 79, improvement: -1.2, studyTime: 35.7, totalNotes: 15, color: "from-emerald-500 to-emerald-600", trend: 'down' },
    { subject: "Mathematics", score: 85, improvement: 4.1, studyTime: 46.8, totalNotes: 22, color: "from-orange-500 to-orange-600", trend: 'up' },
    { subject: "Computer Science", score: 92, improvement: 7.5, studyTime: 52.3, totalNotes: 25, color: "from-red-500 to-red-600", trend: 'up' },
  ]

  const achievements: Achievement[] = [
    { 
      id: "streak-7", 
      name: "7-Day Streak", 
      description: "Studied for 7 consecutive days", 
      icon: "🔥", 
      unlocked: true, 
      dateUnlocked: "2024-01-07",
      rarity: "common"
    },
    { 
      id: "perfect-quiz", 
      name: "Perfect Score", 
      description: "Scored 100% on any quiz", 
      icon: "💯", 
      unlocked: true, 
      progress: 100,
      rarity: "rare"
    },
    { 
      id: "speed-learner", 
      name: "Speed Learner", 
      description: "Complete 5 quizzes in one day", 
      icon: "⚡", 
      unlocked: false, 
      progress: 60,
      rarity: "epic"
    },
    { 
      id: "note-master", 
      name: "Note Master", 
      description: "Upload 50+ study notes", 
      icon: "📚", 
      unlocked: true, 
      progress: 100,
      rarity: "common"
    },
    { 
      id: "early-bird", 
      name: "Early Bird", 
      description: "Study before 7 AM for 5 days", 
      icon: "🌅", 
      unlocked: false, 
      progress: 40,
      rarity: "rare"
    },
    { 
      id: "weekend-warrior", 
      name: "Weekend Warrior", 
      description: "Study 10+ hours on weekends", 
      icon: "🛡️", 
      unlocked: true, 
      progress: 100,
      rarity: "epic"
    },
  ]

  const studyGoals = [
    { goal: "Daily Study Time", current: 45, target: 60, unit: "min" },
    { goal: "Weekly Quizzes", current: 5, target: 7, unit: "quizzes" },
    { goal: "Monthly Notes", current: 18, target: 25, unit: "notes" },
    { goal: "Mastery Level", current: 87, target: 90, unit: "%" },
  ]

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 bg-gray-50'
      case 'rare': return 'border-blue-300 bg-blue-50'
      case 'epic': return 'border-purple-300 bg-purple-50'
      case 'legendary': return 'border-orange-300 bg-orange-50'
    }
  }

  const getTrendIcon = (trend: 'up' | 'down') => {
    return trend === 'up' ? 
      <TrendingUp size={16} className="text-emerald-600" /> : 
      <TrendingUp size={16} className="text-red-600 rotate-180" />
  }

  const maxStudyTime = Math.max(...analyticsData.map(d => d.studyTime))
  const maxScore = Math.max(...analyticsData.map(d => d.avgScore))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium mb-6 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-3">Learning Analytics</h1>
              <p className="text-lg text-slate-600">Comprehensive insights into your study progress and performance</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-slate-700 border border-slate-300">
                <Share2 size={18} />
                Share
              </button>
              <button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold">
                <Download size={18} />
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <stat.icon size={24} className="text-white" />
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {getTrendIcon(stat.trend)}
                  <span className={stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-2">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-900 mb-2">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.description}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Performance Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Performance Overview</h2>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 rounded-lg p-1">
                  {([
                    { id: "studyTime", label: "Study Time", icon: Clock },
                    { id: "performance", label: "Performance", icon: TrendingUp },
                    { id: "productivity", label: "Productivity", icon: Target }
                  ] as const).map((metric) => (
                    <button
                      key={metric.id}
                      onClick={() => setActiveMetric(metric.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeMetric === metric.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <metric.icon size={16} />
                      {metric.label}
                    </button>
                  ))}
                </div>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="7days">Last 7 days</option>
                  <option value="30days">Last 30 days</option>
                  <option value="90days">Last 90 days</option>
                  <option value="1year">Last year</option>
                </select>
              </div>
            </div>

            {/* Enhanced Chart */}
            <div className="space-y-6">
              {/* Study Time Bars */}
              <div className="flex items-end gap-3 h-48">
                {analyticsData.map((data, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center group relative">
                    <div className="flex flex-col items-center justify-end h-40 w-full">
                      {/* Study Time Bar */}
                      <div
                        className="w-8 bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t-lg transition-all duration-500 hover:shadow-lg group-hover:w-10"
                        style={{ height: `${(data.studyTime / maxStudyTime) * 100}%` }}
                      >
                        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
                          {data.studyTime}h study time
                        </div>
                      </div>
                      
                      {/* Score Line */}
                      <div
                        className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full mt-2"
                        style={{ height: `${(data.avgScore / maxScore) * 60}%` }}
                      ></div>
                    </div>
                    
                    <span className="mt-3 text-sm text-slate-600 font-medium">{data.date.split(' ')[1]}</span>
                    <span className="text-xs text-slate-500 mt-1">{data.avgScore}%</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-t from-blue-500 to-cyan-500 rounded"></div>
                  <span>Study Time (hours)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"></div>
                  <span>Average Score (%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Study Goals & Streak */}
          <div className="space-y-6">
            {/* Study Streak */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg p-8 text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Current Streak</p>
                  <p className="text-5xl font-bold">12</p>
                  <p className="text-orange-100 mt-1">Days in a row</p>
                </div>
                <div className="text-4xl">🔥</div>
              </div>
              <div className="pt-6 border-t border-orange-400">
                <p className="text-sm text-orange-100 mb-4 font-medium">Daily Goals Progress</p>
                <div className="space-y-4">
                  {studyGoals.map((goal, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-2">
                        <span>{goal.goal}</span>
                        <span>{goal.current}/{goal.target} {goal.unit}</span>
                      </div>
                      <div className="w-full bg-orange-400/50 rounded-full h-2">
                        <div 
                          className="bg-white h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${(goal.current / goal.target) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Insights */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 size={18} />
                Quick Insights
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-slate-700">Best Subject</span>
                  <span className="font-semibold text-blue-600">Computer Science</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                  <span className="text-slate-700">Most Improved</span>
                  <span className="font-semibold text-emerald-600">Biology +5.2%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                  <span className="text-slate-700">Study Peak</span>
                  <span className="font-semibold text-amber-600">Friday, 6.2h</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Subject Performance */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Subject Performance</h2>
              <button className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
                <Filter size={16} />
                Filter
              </button>
            </div>
            <div className="space-y-6">
              {subjectPerformance.map((subject) => (
                <div 
                  key={subject.subject}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                    selectedSubject === subject.subject 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedSubject(subject.subject)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-slate-900">{subject.subject}</p>
                      <div className="flex items-center gap-1 text-sm">
                        {getTrendIcon(subject.trend)}
                        <span className={subject.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}>
                          {subject.improvement > 0 ? '+' : ''}{subject.improvement}%
                        </span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{subject.score}%</p>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                    <div
                      className={`h-3 rounded-full bg-gradient-to-r ${subject.color}`}
                      style={{ width: `${subject.score}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{subject.studyTime}h studied</span>
                    <span>{subject.totalNotes} notes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Achievements</h2>
              <span className="text-slate-600 text-sm">
                {achievements.filter(a => a.unlocked).length}/{achievements.length} Unlocked
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 text-center group hover:shadow-lg ${
                    achievement.unlocked 
                      ? getRarityColor(achievement.rarity) 
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <p className="text-3xl mb-2 group-hover:scale-110 transition-transform">{achievement.icon}</p>
                  <p className="font-semibold text-slate-900 text-sm mb-1">{achievement.name}</p>
                  <p className="text-xs text-slate-600 mb-2">{achievement.description}</p>
                  
                  {achievement.progress && (
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${achievement.progress}%` }}
                      ></div>
                    </div>
                  )}
                  
                  {achievement.unlocked && achievement.dateUnlocked && (
                    <p className="text-xs text-slate-500 mt-2">
                      Unlocked {new Date(achievement.dateUnlocked).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Study Activity Heatmap */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Study Activity Heatmap</h2>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-200 rounded"></div>
                <span>Less</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>More</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            {Array.from({ length: 12 }).map((_, weekIndex) => (
              <div key={weekIndex} className="flex gap-2">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const intensity = Math.random()
                  return (
                    <div
                      key={dayIndex}
                      className={`w-4 h-4 rounded transition-all duration-300 hover:scale-125 ${
                        intensity > 0.8 ? "bg-gradient-to-br from-blue-600 to-purple-600" :
                        intensity > 0.6 ? "bg-blue-500" :
                        intensity > 0.4 ? "bg-blue-400" :
                        intensity > 0.2 ? "bg-blue-300" :
                        "bg-slate-200"
                      }`}
                      title={`Week ${weekIndex + 1}, Day ${dayIndex + 1}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          
          <div className="flex justify-between text-xs text-slate-500 mt-4">
            <span>12 weeks ago</span>
            <span>This week</span>
          </div>
        </div>
      </div>
    </div>
  )
}