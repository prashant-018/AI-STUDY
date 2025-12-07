import { useState, useEffect } from "react"
import { 
  Sparkles, 
  Copy, 
  Download, 
  RotateCcw, 
  ArrowLeft, 
  Loader, 
  BookOpen, 
  Clock, 
  FileText, 
  Zap, 
  Target, 
  BarChart3, 
  ChevronDown, 
  CheckCircle2, 
  Shield, 
  Brain, 
  AlertCircle, 
  X, 
  Image as ImageIcon 
} from "lucide-react"
import apiFetch, { getAuthToken } from "../utils/api"
import { extractTextFromImage, isImageFile, isOCRSupported, terminateWorker } from "../utils/ocr"

interface AISummaryProps {
  onNavigate: (page: string) => void
}

interface Document {
  _id: string
  title: string
  uploadedAtLabel: string
  fileSize: string
  category: string
  pageCount: number
  fileType: string
  tags: string[]
}

interface SummaryOption {
  id: string
  label: string
  description: string
  icon: React.ComponentType<any>
  color: string
}

export default function AISummary({ onNavigate }: AISummaryProps) {
  const [selectedNote, setSelectedNote] = useState("")
  const [summaryLength, setSummaryLength] = useState(1)
  const [summaryType, setSummaryType] = useState("key-points")
  const [isGenerating, setIsGenerating] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [language, setLanguage] = useState("english")
  const [focusArea, setFocusArea] = useState("")
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [summaryWordCount, setSummaryWordCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isExtractingText, setIsExtractingText] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)

  // Constants
  const summaryLengthLabels = [
    { value: 0, label: "Brief", description: "Key highlights only", words: "50-100" },
    { value: 1, label: "Standard", description: "Balanced overview", words: "200-300" },
    { value: 2, label: "Detailed", description: "Comprehensive analysis", words: "400-500" }
  ]

  const summaryTypes: SummaryOption[] = [
    { 
      id: "key-points", 
      label: "Key Points", 
      description: "Bullet-point summary", 
      icon: Target, 
      color: "from-blue-500 to-cyan-500" 
    },
    { 
      id: "structured", 
      label: "Structured", 
      description: "Organized by topics", 
      icon: BarChart3, 
      color: "from-purple-500 to-pink-500" 
    },
    { 
      id: "simplified", 
      label: "Simplified", 
      description: "Easy to understand", 
      icon: Zap, 
      color: "from-green-500 to-emerald-500" 
    },
    { 
      id: "exam-focused", 
      label: "Exam Focus", 
      description: "Important concepts", 
      icon: FileText, 
      color: "from-orange-500 to-red-500" 
    }
  ]

  const languages = [
    { code: "english", name: "English" },
    { code: "spanish", name: "Spanish" },
    { code: "french", name: "French" },
    { code: "german", name: "German" }
  ]

  const focusAreas = [
    "Key Definitions",
    "Important Formulas",
    "Historical Context",
    "Practical Applications",
    "Common Mistakes",
    "Exam Tips"
  ]

  // Data fetching
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true)
        const data = await apiFetch('/api/documents', { method: 'GET' })
        if (data.success && data.documents) {
          setDocuments(data.documents)
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  // Cleanup OCR worker on unmount
  useEffect(() => {
    return () => {
      terminateWorker().catch(console.error)
    }
  }, [])

  // Summary generation
  const handleGenerateSummary = async () => {
    if (!selectedNote) {
      setError('Please select a document first')
      return
    }

    setIsGenerating(true)
    setSummary(null)
    setError(null)
    setIsExtractingText(false)
    setOcrProgress(0)

    try {
      const selectedDoc = documents.find((d) => d._id === selectedNote)
      if (!selectedDoc) {
        throw new Error('Selected document not found')
      }

      // Map frontend summary type to backend format
      const summaryTypeMap: Record<string, string> = {
        'key-points': 'key_points',
        'structured': 'structured',
        'simplified': 'simplified',
        'exam-focused': 'exam_focus'
      }

      const summaryLengthMap = ['brief', 'standard', 'detailed']
      let extractedText: string | null = null

      // Handle OCR for image files
      if (isImageFile(selectedDoc.fileType) && isOCRSupported(selectedDoc.fileType)) {
        extractedText = await handleOCRProcessing(selectedNote, selectedDoc)
      }

      // Generate summary
      const payload = {
        documentId: selectedNote,
        summaryType: summaryTypeMap[summaryType] || 'key_points',
        summaryLength: summaryLengthMap[summaryLength] || 'standard',
        advancedOptions: {
          focusAreas: focusArea ? [focusArea] : []
        }
      }

      const endpoint = extractedText ? '/api/summaries/generate-from-text' : '/api/summaries/generate-document'
      const finalPayload = extractedText 
        ? { ...payload, noteText: extractedText, documentTitle: selectedDoc.title }
        : payload

      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(finalPayload)
      })

      if (data.success && data.summary) {
        setSummary(data.summary.content)
        setSummaryWordCount(data.summary.wordCount || 0)
        setError(null)
      } else {
        throw new Error(data.error || data.message || 'Failed to generate summary')
      }
    } catch (error: any) {
      handleGenerationError(error)
    } finally {
      setIsGenerating(false)
      setIsExtractingText(false)
      setOcrProgress(0)
    }
  }

  const handleOCRProcessing = async (documentId: string, document: Document) => {
    try {
      setIsExtractingText(true)
      setOcrProgress(0)

      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const token = getAuthToken()

      const imageUrl = `${BASE_URL}/api/documents/${documentId}/view`
      const imageResponse = await fetch(imageUrl, {
        credentials: 'include',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      })

      if (!imageResponse.ok) {
        throw new Error('Could not access image file for OCR processing')
      }

      const imageBlob = await imageResponse.blob()
      const imageFile = new File([imageBlob], document.title, { type: document.fileType })

      const extractedText = await extractTextFromImage(imageFile, (progress) => {
        setOcrProgress(progress)
      })

      setIsExtractingText(false)

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('No readable text could be extracted from the image')
      }

      return extractedText
    } catch (ocrError: any) {
      setIsExtractingText(false)
      throw new Error(`Failed to extract text from image: ${ocrError.message}`)
    }
  }

  const handleGenerationError = (error: any) => {
    console.error('Summary generation error:', error)
    
    let errorMessage = 'Failed to generate summary'

    if (error.data?.error) {
      errorMessage = error.data.error
    } else if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    // Handle specific error types
    const isQuotaError = error.data?.errorType === 'RATE_LIMIT_ERROR' ||
      errorMessage.includes('quota') ||
      errorMessage.includes('rate limit') ||
      error.status === 429

    if (isQuotaError && !errorMessage.includes('upgrade your API plan')) {
      errorMessage += '\n\nYou have reached your API usage limit. Please try again later or upgrade your plan.'
    }

    if (!isQuotaError && errorMessage.includes('API key')) {
      errorMessage += '\n\nGet your API key from: https://makersuite.google.com/app/apikey'
    }

    setError(errorMessage)
  }

  // Utility functions
  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (summary) {
      const element = document.createElement("a")
      const file = new Blob([summary], { type: 'text/plain' })
      element.href = URL.createObjectURL(file)
      element.download = `summary-${selectedNoteData?.title.replace(/\s+/g, '-').toLowerCase()}.txt`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    }
  }

  const getFileTypeIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) return '🖼️'
    if (fileType === 'application/pdf') return '📄'
    return '📝'
  }

  const selectedNoteData = documents.find((d) => d._id === selectedNote)

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
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-3">AI Summary Generator</h1>
              <p className="text-lg text-slate-600 max-w-2xl">
                Transform complex notes into clear, concise summaries using advanced AI analysis
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl">
              <Shield size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Secure & Private</span>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="xl:col-span-1 space-y-6">
            {/* Document Selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen size={18} />
                Select Document
              </h3>
              
              {loading ? (
                <div className="text-center py-4 text-slate-600">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-4 text-slate-600">
                  <p className="text-sm mb-2">No documents found</p>
                  <p className="text-xs text-slate-500">Upload documents first to generate summaries</p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {documents.map((doc) => (
                    <button
                      key={doc._id}
                      onClick={() => setSelectedNote(doc._id)}
                      className={`w-full text-left p-4 rounded-xl transition-all duration-200 border ${
                        selectedNote === doc._id
                          ? "bg-blue-50 border-blue-200 shadow-sm"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-lg">{getFileTypeIcon(doc.fileType)}</span>
                          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
                            {doc.title}
                          </p>
                        </div>
                        {doc.category && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                            {doc.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{doc.fileSize}</span>
                        <span>{doc.uploadedAtLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Summary Length */}
              <div className="border-t border-slate-200 pt-6">
                <label className="text-sm font-semibold text-slate-900 block mb-4">
                  Summary Length
                </label>
                <div className="space-y-2">
                  {summaryLengthLabels.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSummaryLength(option.value)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-200 border ${
                        summaryLength === option.value
                          ? "bg-blue-600 text-white border-transparent shadow-sm"
                          : "bg-white border-slate-300 hover:border-slate-400 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.label}</span>
                        {summaryLength === option.value && <CheckCircle2 size={16} />}
                      </div>
                      <p className={`text-xs mt-1 ${
                        summaryLength === option.value ? "text-blue-100" : "text-slate-500"
                      }`}>
                        {option.description} • {option.words} words
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-sm font-semibold text-slate-900"
              >
                <span>Advanced Options</span>
                <ChevronDown size={16} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      {languages.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      Focus Area
                    </label>
                    <select
                      value={focusArea}
                      onChange={(e) => setFocusArea(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">All topics</option>
                      {focusAreas.map(area => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="xl:col-span-3 space-y-6">
            {/* Summary Type Selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Summary Type</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSummaryType(type.id)}
                    className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                      summaryType === type.id
                        ? `bg-gradient-to-br ${type.color} text-white border-transparent shadow-lg`
                        : "bg-white border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-md"
                    }`}
                  >
                    <type.icon size={24} className="mb-3" />
                    <p className="font-semibold text-sm mb-1">{type.label}</p>
                    <p className="text-xs opacity-80">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">
                      Error Generating Summary
                    </h3>
                    <div className="text-sm text-red-800 mb-4 whitespace-pre-wrap">
                      {error}
                    </div>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="p-1 hover:bg-red-100 rounded-full transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Generation Area */}
            {isGenerating && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="relative inline-block mb-6">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 mx-auto ${
                      isExtractingText ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {isExtractingText ? (
                        <ImageIcon size={32} className="text-white" />
                      ) : (
                        <Brain size={32} className="text-white" />
                      )}
                    </div>
                    <Loader className="w-6 h-6 animate-spin text-blue-500 absolute -top-2 -right-2" />
                  </div>

                  <h3 className="text-xl font-semibold text-slate-900 mb-3">
                    {isExtractingText ? 'Extracting Text from Image' : 'Generating Your Summary'}
                  </h3>
                  <p className="text-slate-600 mb-6">
                    {isExtractingText 
                      ? `Using OCR to extract text from your image... ${ocrProgress > 0 ? `${ocrProgress}% complete` : ''}`
                      : `Creating a ${summaryLengthLabels[summaryLength].label.toLowerCase()} summary...`
                    }
                  </p>

                  {isExtractingText && ocrProgress > 0 && (
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary Result */}
            {summary && !isGenerating && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-8 gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      AI-Generated Summary
                    </h2>
                    {selectedNoteData && (
                      <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                        <span>From: <strong>{selectedNoteData.title}</strong></span>
                        <span>•</span>
                        <span>{selectedNoteData.fileSize}</span>
                        {selectedNoteData.category && (
                          <>
                            <span>•</span>
                            <span>{selectedNoteData.category}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-700 font-medium"
                    >
                      <Copy size={18} className={copied ? "text-green-600" : ""} />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      <Download size={18} />
                      Download
                    </button>
                  </div>
                </div>

                {/* Summary Content */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
                  <pre className="text-slate-800 leading-relaxed whitespace-pre-wrap font-sans text-sm">
                    {summary}
                  </pre>
                </div>

                {/* Summary Analytics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-slate-200">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600">{summaryWordCount}</p>
                    <p className="text-sm text-slate-600">Words</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <p className="text-2xl font-bold text-purple-600">
                      {summary.split('\n').filter(line => line.trim().startsWith('-')).length}
                    </p>
                    <p className="text-sm text-slate-600">Key Points</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-xl">
                    <p className="text-2xl font-bold text-emerald-600">
                      {Math.ceil(summaryWordCount / 200)}m
                    </p>
                    <p className="text-sm text-slate-600">Read Time</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-xl">
                    <p className="text-2xl font-bold text-orange-600">85%</p>
                    <p className="text-sm text-slate-600">Content Reduced</p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!summary && !isGenerating && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <Sparkles size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">
                    Ready to Summarize
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Select a document and choose your preferred summary type to generate an AI-powered summary.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handleGenerateSummary}
            disabled={!selectedNote || isGenerating}
            className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg"
          >
            {isGenerating ? (
              <>
                <Loader size={20} className="animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generate AI Summary
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}