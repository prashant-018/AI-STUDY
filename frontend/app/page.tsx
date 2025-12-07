"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import LoginSignup from "@/components/login-signup"
import Dashboard from "@/components/dashboard"
import UploadNotes from "@/components/upload-notes"
import AISummary from "@/components/ai-summary"
import FlashcardsViewer from "@/components/flashcards-viewer"
import QuizPage from "@/components/quiz-page"
import ProgressAnalytics from "@/components/progress-analytics"
import { useAuth } from "@/context/AuthContext"

function HomeContent() {
  const searchParams = useSearchParams()
  const auth = useAuth() as any
  const { user, loading } = auth
  const [currentPage, setCurrentPage] = useState("login")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const handleLogin = () => {
    setIsAuthenticated(true)
    setCurrentPage("dashboard")
  }

  const handleNavigation = (page: string) => {
    setCurrentPage(page)
  }

  const handleLogout = async () => {
    try {
      // Call the logout function from AuthContext to clear token and user data
      if (auth?.logoutUser) {
        await auth.logoutUser()
      }
      // Update local state
      setIsAuthenticated(false)
      setCurrentPage("login")
    } catch (error) {
      console.error("Logout error:", error)
      // Even if logout fails, clear local state
      setIsAuthenticated(false)
      setCurrentPage("login")
    }
  }

  // Check authentication status from AuthContext
  useEffect(() => {
    if (!loading) {
      if (user) {
        setIsAuthenticated(true)
        if (currentPage === "login") {
          setCurrentPage("dashboard")
        }
      } else {
        setIsAuthenticated(false)
        setCurrentPage("login")
      }
    }
  }, [user, loading, currentPage])

  // Handle OAuth errors from URL
  useEffect(() => {
    const error = searchParams?.get("error")
    const reason = searchParams?.get("reason")
    const details = searchParams?.get("details")

    if (error) {
      // Log error once, concisely
      if (error === "google_auth_failed") {
        const errorMsg = details ? decodeURIComponent(details) : (reason || "Google authentication failed")
        console.warn("⚠️ Google OAuth Error:", errorMsg)
      }

      // Clear error from URL to prevent it from showing again on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete("error")
      url.searchParams.delete("reason")
      url.searchParams.delete("details")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  const renderPage = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    if (!isAuthenticated || !user) {
      return <LoginSignup onLogin={handleLogin} />
    }

    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigation} onLogout={handleLogout} />
      case "upload":
        return <UploadNotes onNavigate={handleNavigation} />
      case "summary":
        return <AISummary onNavigate={handleNavigation} />
      case "flashcards":
        return <FlashcardsViewer onNavigate={handleNavigation} />
      case "quiz":
        return <QuizPage onNavigate={handleNavigation} />
      case "analytics":
        return <ProgressAnalytics onNavigate={handleNavigation} />
      default:
        return <Dashboard onNavigate={handleNavigation} onLogout={handleLogout} />
    }
  }

  return <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">{renderPage()}</main>
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
