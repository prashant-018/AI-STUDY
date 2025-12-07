import type React from "react"
import { useState, useEffect } from "react"
import { Mail, Lock, Eye, EyeOff, Github, Chrome, User, CheckCircle, AlertCircle } from "lucide-react"
import { useAuth } from "../context/AuthContext"

interface LoginSignupProps {
  onLogin: () => void
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  terms?: string
}

export default function LoginSignup({ onLogin }: LoginSignupProps) {
  const { registerUser, loginUser } = useAuth() as any
  const [isSignup, setIsSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false
  })

  // Load remembered email on mount and check for OAuth errors
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail')
    if (rememberedEmail) {
      setEmail(rememberedEmail)
      setRememberMe(true)
    }

      // Check for OAuth errors in URL
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')
        const reason = urlParams.get('reason')
        const details = urlParams.get('details')

        if (error) {
          let errorMessage = 'Google authentication failed. Please try again.'
          
          // Handle specific OAuth errors
          if (error === 'deleted_client') {
            errorMessage = 'Google OAuth client has been deleted or is invalid. Please create a new OAuth client in Google Cloud Console. See FIX_DELETED_CLIENT.md for instructions.'
          } else if (error === 'redirect_uri_mismatch') {
            errorMessage = 'Redirect URI mismatch. Please check Google Cloud Console configuration.'
          } else if (error === 'access_blocked' || error === 'access_denied') {
            errorMessage = 'Access was denied or blocked. Please try again.'
          } else if (error === 'popup_blocked') {
            errorMessage = 'Popup was blocked. Please allow popups for this site and try again.'
          } else if (error === 'cancelled' || error === 'user_cancelled') {
            errorMessage = 'Google authentication was cancelled.'
          } else if (error === 'no_user') {
            errorMessage = 'Unable to retrieve user information from Google. Please try again.'
          } else if (details) {
            errorMessage = decodeURIComponent(details)
          }
          
          setOauthError(errorMessage)

          // Clear error from URL
          const url = new URL(window.location.href)
          url.searchParams.delete('error')
          url.searchParams.delete('reason')
          url.searchParams.delete('details')
          window.history.replaceState({}, '', url.toString())

          // Clear error after 8 seconds
          setTimeout(() => setOauthError(null), 8000)
        }
      }
  }, [])

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!password) {
      newErrors.password = "Password is required"
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    if (isSignup && password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (isSignup && !acceptedTerms) {
      newErrors.terms = "You must agree to the Terms and Privacy Policy"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true, confirmPassword: true })

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      if (isSignup) {
        // Register new user
        const response = await registerUser({
          name: email.split('@')[0], // Use email prefix as name, or you can add a name field
          email,
          password
        })

        if (response?.success) {
          // Store email in localStorage if "remember me" is checked
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email)
          } else {
            localStorage.removeItem('rememberedEmail')
          }
          onLogin()
        } else {
          // Handle validation errors from backend
          if (response?.errors) {
            const backendErrors: FormErrors = {}
            response.errors.forEach((err: { field: string; message: string }) => {
              if (err.field === 'email') backendErrors.email = err.message
              if (err.field === 'password') backendErrors.password = err.message
            })
            setErrors(backendErrors)
          } else {
            setErrors({ email: response?.message || 'Registration failed' })
          }
        }
      } else {
        // Login existing user
        const response = await loginUser({ email, password })

        if (response?.success) {
          // Store email in localStorage if "remember me" is checked
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email)
          } else {
            localStorage.removeItem('rememberedEmail')
          }
          onLogin()
        } else {
          // Handle login errors
          if (response?.errors) {
            const backendErrors: FormErrors = {}
            response.errors.forEach((err: { field: string; message: string }) => {
              if (err.field === 'email' || err.field === 'general') {
                backendErrors.email = err.message
              }
              if (err.field === 'password' || err.field === 'general') {
                backendErrors.password = err.message
              }
            })
            setErrors(backendErrors)
          } else {
            setErrors({ email: response?.message || 'Login failed' })
          }
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      setErrors({
        email: error?.message || error?.data?.message || 'An error occurred. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getInputClassName = (hasError: boolean) =>
    `w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${hasError
      ? "border-red-300 focus:ring-red-500 bg-red-50"
      : "border-gray-300 focus:ring-purple-500 hover:border-gray-400"
    }`

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Side - Professional Gradient Background */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 -left-10 w-80 h-80 bg-white rounded-full mix-blend-soft-light filter blur-3xl"></div>
          <div className="absolute bottom-1/4 -right-10 w-80 h-80 bg-blue-300 rounded-full mix-blend-soft-light filter blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-soft-light filter blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 mb-8">
            <div className="text-3xl">🧠</div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            AI Study <span className="text-blue-200">Companion</span>
          </h1>
          <p className="text-xl text-white/90 leading-relaxed mb-8">
            Accelerate your learning journey with intelligent, personalized study assistance powered by advanced AI technology.
          </p>
          <div className="flex justify-center space-x-8 text-white/80">
            <div className="text-center">
              <div className="text-2xl font-bold">10K+</div>
              <div className="text-sm">Active Students</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">98%</div>
              <div className="text-sm">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">24/7</div>
              <div className="text-sm">AI Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Professional Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-10 text-center lg:text-left">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mb-4">
              <User className="text-white" size={24} />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              {isSignup ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-gray-600 text-lg">
              {isSignup ? "Join thousands of students accelerating their learning" : "Sign in to continue your learning journey"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-3 ${errors.email ? "text-red-500" : "text-gray-400"
                  }`} size={20} />
                <input
                  type="email"
                  placeholder="your.email@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  className={getInputClassName(!!errors.email && touched.email)}
                />
                {touched.email && !errors.email && email && (
                  <CheckCircle className="absolute right-3 top-3 text-green-500" size={20} />
                )}
              </div>
              {touched.email && errors.email && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.email}
                </div>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-3 ${errors.password ? "text-red-500" : "text-gray-400"
                  }`} size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  className={getInputClassName(!!errors.password && touched.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {touched.password && errors.password && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.password}
                </div>
              )}
            </div>

            {/* Confirm Password (Signup only) */}
            {isSignup && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-3 ${errors.confirmPassword ? "text-red-500" : "text-gray-400"
                    }`} size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    className={getInputClassName(!!errors.confirmPassword && touched.confirmPassword)}
                  />
                  {touched.confirmPassword && !errors.confirmPassword && confirmPassword && (
                    <CheckCircle className="absolute right-3 top-3 text-green-500" size={20} />
                  )}
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <div className="flex items-center mt-2 text-red-600 text-sm">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.confirmPassword}
                  </div>
                )}
              </div>
            )}

            {/* Remember me & Forgot Password */}
            {!isSignup && (
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 border rounded transition-all duration-200 ${rememberMe
                      ? "bg-indigo-600 border-indigo-600"
                      : "bg-white border-gray-300"
                      }`}>
                      {rememberMe && (
                        <CheckCircle className="text-white" size={18} />
                      )}
                    </div>
                  </div>
                  <span className="ml-3 text-sm text-gray-700 font-medium">Remember me</span>
                </label>
                <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            {/* Terms Agreement (Signup only) */}
            {isSignup && (
              <div>
                <label className="flex items-start cursor-pointer">
                  <div className="relative mt-1">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 border rounded flex items-center justify-center transition-all duration-200 ${acceptedTerms
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white border-gray-300"
                        }`}
                    >
                      {acceptedTerms && <CheckCircle className="text-white" size={14} />}
                    </div>
                  </div>
                  <span className="ml-3 text-sm text-gray-600">
                    I agree to the{" "}
                    <a href="#" className="text-indigo-600 hover:text-indigo-700 font-medium">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-indigo-600 hover:text-indigo-700 font-medium">
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {errors.terms && (
                  <p className="text-sm text-red-600 mt-2 flex items-center">
                    <AlertCircle size={16} className="mr-1" /> {errors.terms}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-4 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {isSignup ? "Creating Account..." : "Signing In..."}
                </>
              ) : (
                isSignup ? "Create Account" : "Sign In to Dashboard"
              )}
            </button>
          </form>

          {/* OAuth Error Message */}
          {oauthError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{oauthError}</p>
                <p className="text-xs text-red-600 mt-1">You can try signing in with email and password instead.</p>
              </div>
              <button
                onClick={() => setOauthError(null)}
                className="text-red-600 hover:text-red-800 transition-colors"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {/* OAuth Section */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-600 font-medium">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  try {
                    // Use relative URL if proxied, or absolute if direct
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
                    // Use /api/auth/google for Next.js proxy, or direct backend URL
                    const googleAuthUrl = apiUrl ? `${apiUrl}/api/auth/google` : "/api/auth/google";
                    console.log("🔵 Redirecting to Google OAuth:", googleAuthUrl);
                    
                    // Redirect to Google OAuth
                    window.location.href = googleAuthUrl;
                  } catch (error) {
                    console.error("❌ Error initiating Google OAuth:", error);
                    setOauthError("Failed to initiate Google login. Please try again.");
                  }
                }}
                className="flex-1 flex items-center justify-center gap-3 py-3.5 border border-gray-300 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all duration-200 bg-white hover:bg-gray-50"
              >
                <Chrome size={20} className="text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Continue with Google</span>
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-3 py-3.5 border border-gray-300 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all duration-200 bg-white opacity-50 cursor-not-allowed"
                disabled
              >
                <Github size={20} className="text-gray-900" />
                <span className="text-sm font-semibold text-gray-700">GitHub</span>
              </button>
            </div>
          </div>

          {/* Toggle Sign up / Login */}
          <div className="mt-10 text-center">
            <p className="text-gray-700 font-medium">
              {isSignup ? "Already have an account?" : "New to AI Study Companion?"}{" "}
              <button
                onClick={() => setIsSignup(!isSignup)}
                className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
              >
                {isSignup ? "Sign In" : "Create Account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}