import type React from "react"
import { Cloud, X, Search, Trash2, FileText, ArrowLeft, FolderOpen, Download, MoreVertical, Eye, Share2, BookOpen, CheckCircle, AlertCircle, Upload, Sparkles, Loader2, FileText as FileTextIcon, Zap } from "lucide-react"
import { useState, useEffect } from "react"
import apiFetch, { getAuthToken } from "../utils/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"

interface UploadNotesProps {
  onNavigate: (page: string) => void
}

interface UploadedFile {
  id: number
  name: string
  size: string
  progress: number
  status: 'uploading' | 'success' | 'error'
  type: string
  file?: File // Store the actual File object
}

interface UploadedNote {
  _id: string
  id?: number
  title: string
  uploadedAtLabel: string
  date?: string
  fileSize: string
  size?: string
  category: string
  pageCount: number
  pages?: number
  lastOpenedLabel: string
  lastAccessed?: string
  tags: string[]
  filePath: string
  fileType: string
  autoFlashcardsStatus?: 'queued' | 'processing' | 'completed' | 'failed'
  autoFlashcardsCount?: number
  autoFlashcardsError?: string
}

export default function UploadNotes({ onNavigate }: UploadNotesProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploadedNotes, setUploadedNotes] = useState<UploadedNote[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'by-category'>('all')
  const [selectedNotes, setSelectedNotes] = useState<Array<string | number>>([])
  const [generatingFlashcards, setGeneratingFlashcards] = useState<string | null>(null)
  const [generatingQuiz, setGeneratingQuiz] = useState<string | null>(null)
  const [viewingNotes, setViewingNotes] = useState<UploadedNote | null>(null)
  const [notesContent, setNotesContent] = useState<string>("")
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return "📄"
    if (type.includes('word') || type.includes('document')) return "📝"
    if (type.includes('image')) return "🖼️"
    if (type.includes('text')) return "📃"
    return "📎"
  }

  const addFiles = (fileList: File[]) => {
    fileList.forEach((file, index) => {
      const newFile: UploadedFile = {
        id: Date.now() + index,
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + " MB",
        progress: 0,
        status: 'uploading',
        type: file.type,
        file: file // Store the actual File object
      }
      setFiles((prev) => [...prev, newFile])
    })
  }

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/api/documents', { method: 'GET' })
      if (data.success && data.documents) {
        setUploadedNotes(data.documents)
      }
    } catch (error: any) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (id: number) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const removeNote = async (id: string) => {
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
      setUploadedNotes((prev) => prev.filter((n) => n._id !== id))
      setSelectedNotes(prev => prev.filter(noteId => noteId !== id))
      await fetchDocuments() // Refresh list
    } catch (error: any) {
      console.error('Failed to delete document:', error)
      alert('Failed to delete document')
    }
  }

  const handleUpload = async () => {
    if (files.length === 0 || !title) return

    setUploading(true)
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
    const token = getAuthToken()

    try {
      // Upload each file
      for (const fileItem of files) {
        // Use the stored File object
        const file = fileItem.file
        if (!file) continue

        // Update file status to uploading
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id ? { ...f, status: 'uploading', progress: 0 } : f
        ))

        // Create FormData
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', title)
        if (category) formData.append('category', category)
        if (description) formData.append('description', description)
        if (tags) formData.append('tags', tags)

        // Upload file
        const response = await fetch(`${BASE_URL}/api/documents/upload`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: formData
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id ? { ...f, status: 'success', progress: 100 } : f
          ))
        } else {
          setFiles(prev => prev.map(f =>
            f.id === fileItem.id ? { ...f, status: 'error', progress: 0 } : f
          ))
          throw new Error(data.error || 'Upload failed')
        }
      }

      // Refresh documents list
      await fetchDocuments()

      // Clear form
      setFiles([])
      setTitle("")
      setCategory("")
      setDescription("")
      setTags("")

      // Clear file input - find the actual input element
      const fileInputs = document.querySelectorAll('input[type="file"]')
      fileInputs.forEach((input) => {
        (input as HTMLInputElement).value = ''
      })
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(error.message || 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const toggleNoteSelection = (id: string | number) => {
    setSelectedNotes(prev =>
      prev.includes(id as any)
        ? prev.filter(noteId => noteId !== id)
        : [...prev, id as any]
    )
  }

  const filteredNotes = uploadedNotes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.category && note.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

  const handleView = (note: UploadedNote) => {
    window.open(`${BASE_URL}/api/documents/${note._id}/view`, '_blank')
  }

  const handleDownload = (note: UploadedNote) => {
    window.open(`${BASE_URL}/api/documents/${note._id}/download`, '_blank')
  }

  const handleShare = async (note: UploadedNote) => {
    try {
      // Get share link from backend
      const data = await apiFetch(`/api/documents/${note._id}/share`, { method: 'GET' })

      if (data.success) {
        // Create a shareable link (note: requires authentication to view)
        const shareLink = `${BASE_URL}/api/documents/${note._id}/view`

        // Try to use Web Share API if available (mobile/desktop with share support)
        if (navigator.share) {
          try {
            await navigator.share({
              title: note.title,
              text: `Check out this document: ${note.title}`,
              url: shareLink,
            })
            return
          } catch (err: any) {
            // User cancelled sharing - that's okay, just return
            if (err.name === 'AbortError') {
              return
            }
            // Other error, fall back to clipboard
          }
        }

        // Fallback: Copy to clipboard
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareLink)
            alert(`Share link copied to clipboard!\n\n${shareLink}\n\nNote: The recipient needs to be logged in to view this document.`)
          } else {
            // Fallback for browsers without clipboard API
            const textArea = document.createElement('textarea')
            textArea.value = shareLink
            textArea.style.position = 'fixed'
            textArea.style.left = '-999999px'
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
            alert(`Share link copied to clipboard!\n\n${shareLink}\n\nNote: The recipient needs to be logged in to view this document.`)
          }
        } catch (clipboardError) {
          // If clipboard fails, show the link in an alert so user can copy manually
          alert(`Share link:\n\n${shareLink}\n\nPlease copy this link manually.\n\nNote: The recipient needs to be logged in to view this document.`)
        }
      } else {
        throw new Error(data.error || 'Failed to generate share link')
      }
    } catch (error: any) {
      console.error('Share error:', error)
      alert(error.message || 'Failed to share document')
    }
  }

  const isImageFile = (fileType: string) => {
    return fileType?.startsWith('image/')
  }

  const handleViewNotes = async (note: UploadedNote) => {
    if (!isImageFile(note.fileType) && note.fileType !== 'application/pdf' && note.fileType !== 'text/plain') {
      alert('Notes viewing is only available for images, PDFs, and text files')
      return
    }

    setViewingNotes(note)
    setNotesContent("")
    setNotesError(null)
    setLoadingNotes(true)

    try {
      const data = await apiFetch(`/api/documents/${note._id}/content`, { method: 'GET' })

      if (data.success) {
        setNotesContent(data.content)
      } else {
        throw new Error(data.error || 'Failed to load notes content')
      }
    } catch (error: any) {
      console.error('Load notes error:', error)
      setNotesError(error.message || 'Failed to extract text from document. Make sure the image contains readable text.')
    } finally {
      setLoadingNotes(false)
    }
  }

  const handleGenerateFlashcards = async (note: UploadedNote) => {
    if (!isImageFile(note.fileType) && note.fileType !== 'application/pdf' && note.fileType !== 'text/plain') {
      alert('Flashcard generation is only available for images, PDFs, and text files')
      return
    }

    try {
      setGeneratingFlashcards(note._id)
      const data = await apiFetch(`/api/documents/${note._id}/generate-flashcards`, {
        method: 'POST',
        body: JSON.stringify({ maxCards: 6 })
      })

      if (data.success) {
        alert(`Successfully generated ${data.flashcardsCount} flashcards! You can now study them in the Flashcards section.`)
        // Refresh documents to update status
        await fetchDocuments()
        // Close notes modal if open
        if (viewingNotes?._id === note._id) {
          setViewingNotes(null)
        }
        // Optionally navigate to flashcards
        const shouldNavigate = confirm(`Would you like to go to Flashcards Study now?`)
        if (shouldNavigate) {
          onNavigate('flashcards')
        }
      } else {
        throw new Error(data.error || 'Failed to generate flashcards')
      }
    } catch (error: any) {
      console.error('Generate flashcards error:', error)
      alert(error.message || 'Failed to generate flashcards. Make sure the image contains readable text.')
    } finally {
      setGeneratingFlashcards(null)
    }
  }

  const handleGenerateFlashcardsFromNotes = async () => {
    if (!viewingNotes) return
    await handleGenerateFlashcards(viewingNotes)
  }

  const handleGenerateQuiz = async (note: UploadedNote) => {
    if (!isImageFile(note.fileType) && note.fileType !== 'application/pdf' && note.fileType !== 'text/plain') {
      alert('Quiz generation is only available for images, PDFs, and text files')
      return
    }

    try {
      setGeneratingQuiz(note._id)
      const data = await apiFetch(`/api/documents/${note._id}/generate-questions`, {
        method: 'POST',
        body: JSON.stringify({ maxQuestions: 6 })
      })

      if (data.success && data.questions && data.questions.length > 0) {
        // Store questions in sessionStorage to pass to quiz page
        sessionStorage.setItem('generatedQuizQuestions', JSON.stringify(data.questions))
        sessionStorage.setItem('generatedQuizTitle', note.title)
        sessionStorage.setItem('generatedQuizSubject', note.category || 'General')

        alert(`Successfully generated ${data.questionsCount} quiz questions! Redirecting to quiz...`)
        // Navigate to quiz page
        onNavigate('quiz')
      } else {
        throw new Error(data.error || 'Failed to generate quiz questions')
      }
    } catch (error: any) {
      console.error('Generate quiz error:', error)
      alert(error.message || 'Failed to generate quiz questions. Make sure the document contains readable text.')
    } finally {
      setGeneratingQuiz(null)
    }
  }

  const handleGenerateQuizFromNotes = async () => {
    if (!viewingNotes) return
    await handleGenerateQuiz(viewingNotes)
  }

  const categories = ["Biology", "Physics", "Chemistry", "Mathematics", "History", "Computer Science", "Literature"]
  const stats = {
    totalNotes: uploadedNotes.length,
    totalSize: uploadedNotes.reduce((acc, note) => {
      const sizeStr = note.fileSize || note.size || "0 MB"
      const sizeNum = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) || 0
      return acc + sizeNum
    }, 0).toFixed(1) + " MB",
    categories: [...new Set(uploadedNotes.map(note => note.category).filter(Boolean))].length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-6 sm:px-6">
      {/* Enhanced Header */}
      <div className="max-w-7xl mx-auto mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() => onNavigate("dashboard")}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium mb-3 transition-colors group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Document Library</h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl">
              Upload, organize, and manage your study materials with AI-powered categorization
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm w-full md:max-w-md">
            {[
              { label: "Total Notes", value: stats.totalNotes },
              { label: "Storage Used", value: stats.totalSize },
              { label: "Categories", value: stats.categories }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile stats carousel */}
        <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-thin">
          <div className="flex gap-4 min-w-max">
            {[
              { label: "Documents", value: stats.totalNotes, icon: FileText },
              { label: "Storage", value: stats.totalSize, icon: Cloud },
              { label: "Subjects", value: stats.categories, icon: BookOpen }
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                <stat.icon size={18} className="text-blue-600" />
                <div>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid gap-8 lg:grid-cols-4">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Enhanced Upload Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Upload New Documents</h2>
              <p className="text-slate-600 mt-1">Supported formats: PDF, DOC, DOCX, TXT, Images</p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-6 sm:p-8 transition-all duration-300 ${isDragging
                ? "bg-blue-50 border-2 border-blue-300 border-dashed"
                : "bg-slate-50/80 border-2 border-slate-200 border-dashed"
                }`}
            >
              <div className="text-center max-w-md mx-auto">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto ${isDragging ? "bg-blue-100 text-blue-600" : "bg-white text-slate-600 shadow-sm"
                  }`}>
                  <Upload size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {isDragging ? "Drop to upload" : "Drag and drop your files"}
                </h3>
                <p className="text-slate-600 mb-4">or</p>
                <label className="inline-block">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer inline-flex items-center gap-2 font-medium">
                    <FolderOpen size={18} />
                    Browse Files
                  </span>
                </label>
                <p className="text-sm text-slate-500 mt-4">Maximum file size: 50MB per file</p>
              </div>
            </div>
          </div>

          {/* Active Uploads */}
          {files.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Upload Progress</h2>
                <span className="text-sm text-slate-600">{files.length} files</span>
              </div>

              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                    <div className="text-2xl">{getFileIcon(file.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                        <p className="font-medium text-slate-900 truncate">{file.name}</p>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${file.status === 'success' ? 'text-emerald-600' :
                            file.status === 'error' ? 'text-red-600' : 'text-slate-600'
                            }`}>
                            {file.status === 'success' ? 'Completed' :
                              file.status === 'error' ? 'Failed' : `${file.progress}%`}
                          </span>
                          {file.status === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
                          {file.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mb-2 justify-between">
                        <span>{file.size}</span>
                        <span>{file.type || 'Unknown type'}</span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${file.status === 'success' ? 'bg-emerald-500' :
                            file.status === 'error' ? 'bg-red-500' :
                              'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                          style={{ width: `${file.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-end w-full sm:w-auto">
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-red-600 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Notes List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-900">Your Documents</h2>

                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search notes, categories, tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                    />
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      {[
                        { id: 'all', label: 'All Notes' },
                        { id: 'recent', label: 'Recent' },
                        { id: 'by-category', label: 'By Category' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {selectedNotes.length > 0 && (
                      <button
                        onClick={async () => {
                          const imageNotes = uploadedNotes.filter(note =>
                            selectedNotes.includes(note._id as any) &&
                            (isImageFile(note.fileType) || note.fileType === 'application/pdf' || note.fileType === 'text/plain')
                          )
                          if (imageNotes.length === 0) {
                            alert('Please select images, PDFs, or text files to generate flashcards')
                            return
                          }
                          const confirmed = confirm(`Generate flashcards from ${imageNotes.length} selected file(s)?`)
                          if (!confirmed) return

                          for (const note of imageNotes) {
                            await handleGenerateFlashcards(note)
                            // Small delay to avoid overwhelming the API
                            await new Promise(resolve => setTimeout(resolve, 500))
                          }
                          setSelectedNotes([])
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
                      >
                        <Sparkles size={16} />
                        Generate Flashcards ({selectedNotes.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Grid/List */}
            {filteredNotes.length === 0 ? (
              <div className="p-12 text-center text-slate-600">
                <FileText size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium text-slate-900 mb-2">No documents found</p>
                <p className="text-slate-600">Upload your first document to get started</p>
              </div>
            ) : (
              <div className="p-1">
                {filteredNotes.map((note) => (
                  <div
                    key={note._id}
                    className="flex flex-col gap-4 p-4 hover:bg-slate-50/80 transition-all duration-200 group border-b border-slate-100 last:border-b-0 sm:flex-row sm:items-center"
                  >
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedNotes.includes(note._id as any)}
                      onChange={() => toggleNoteSelection(note._id as any)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />

                    {/* File Icon or Image Preview */}
                    {isImageFile(note.fileType) ? (
                      <div
                        className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all group/image"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGenerateFlashcards(note)
                        }}
                        title="Click to convert to flashcards"
                      >
                        <img
                          src={`/api/documents/${note._id}/view`}
                          alt={note.title}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center"><span class="text-2xl">🖼️</span></div>'
                            }
                          }}
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-blue-600/0 hover:bg-blue-600/20 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100">
                          <div className="bg-white/90 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 flex items-center gap-1">
                            <Sparkles size={12} />
                            <span>Click to Convert</span>
                          </div>
                        </div>
                        {/* Loading indicator */}
                        {generatingFlashcards === note._id && (
                          <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                            <Loader2 size={20} className="animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileText size={20} className="text-blue-600" />
                      </div>
                    )}

                    {/* Note Details */}
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 truncate">{note.title}</p>
                            {isImageFile(note.fileType) && (
                              <span
                                className="text-xs text-blue-600 font-medium cursor-pointer hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGenerateFlashcards(note)
                                }}
                                title="Click to convert to flashcards"
                              >
                                (Click image to convert)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-slate-600">
                            <span className="text-sm text-slate-600">{note.fileSize || note.size}</span>
                            <span className="text-sm text-slate-500">•</span>
                            <span className="text-sm text-slate-600">{note.pageCount || note.pages || 0} pages</span>
                            <span className="text-sm text-slate-500">•</span>
                            <span className="text-sm text-slate-600">{note.uploadedAtLabel || note.date || 'Never'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Always visible action buttons for images/PDFs */}
                          {(isImageFile(note.fileType) || note.fileType === 'application/pdf' || note.fileType === 'text/plain') && (
                            <>
                              <button
                                onClick={() => handleViewNotes(note)}
                                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 rounded-lg text-purple-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                                title="View Notes"
                              >
                                <FileTextIcon size={14} />
                                <span>View Notes</span>
                              </button>
                              <button
                                onClick={() => handleGenerateFlashcards(note)}
                                disabled={generatingFlashcards === note._id}
                                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1.5"
                                title="Generate Flashcards"
                              >
                                {generatingFlashcards === note._id ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Generating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={14} />
                                    <span>Generate Flashcards</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleGenerateQuiz(note)}
                                disabled={generatingQuiz === note._id}
                                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 rounded-lg text-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1.5"
                                title="Generate Quiz"
                              >
                                {generatingQuiz === note._id ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Generating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap size={14} />
                                    <span>Generate Quiz</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                          {/* Other actions - visible on hover */}
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleView(note)}
                              className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDownload(note)}
                              className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                              title="Download"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => handleShare(note)}
                              className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                              title="Share"
                            >
                              <Share2 size={16} />
                            </button>
                            <button
                              onClick={() => removeNote(note._id)}
                              className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Tags and Category */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {note.category}
                        </span>
                        {note.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700"
                          >
                            #{tag}
                          </span>
                        ))}
                        {isImageFile(note.fileType) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                            📸 Image
                          </span>
                        )}
                        {note.autoFlashcardsStatus === 'completed' && note.autoFlashcardsCount && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">
                            ✨ {note.autoFlashcardsCount} Flashcards
                          </span>
                        )}
                        {note.autoFlashcardsStatus === 'processing' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                            <Loader2 size={12} className="animate-spin mr-1" />
                            Generating...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Sidebar */}
        <div className="space-y-6">
          {/* Upload Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 lg:sticky lg:top-6">
            <h3 className="font-semibold text-slate-900 mb-4">Document Details</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter document title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Description</label>
                <textarea
                  placeholder="Add a brief description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Tags</label>
                <input
                  type="text"
                  placeholder="e.g., cells, anatomy, biology"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
                <p className="text-xs text-slate-500 mt-1">Separate tags with commas</p>
              </div>

              <button
                onClick={handleUpload}
                disabled={files.length === 0 || !title || uploading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl hover:shadow-lg transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
              >
                <Upload size={18} />
                {uploading ? 'Uploading...' : 'Upload Documents'}
              </button>
            </div>
          </div>

          {/* Storage Overview */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
            <h3 className="font-semibold mb-4">Storage Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Used Space</span>
                  <span>2.1 GB / 15 GB</span>
                </div>
                <div className="w-full bg-blue-500/30 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full" style={{ width: '14%' }}></div>
                </div>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Documents</span>
                  <span>1.2 GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Images</span>
                  <span>0.8 GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Other</span>
                  <span>0.1 GB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Notes Modal */}
      <Dialog open={!!viewingNotes} onOpenChange={(open) => !open && setViewingNotes(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileTextIcon size={20} />
              {viewingNotes?.title || 'View Notes'}
            </DialogTitle>
            <DialogDescription>
              Extracted text content from {viewingNotes?.fileType?.startsWith('image/') ? 'image' : 'document'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {loadingNotes ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-slate-600">Extracting text from document...</p>
                </div>
              </div>
            ) : notesError ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle size={32} className="text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-2">{notesError}</p>
                  <p className="text-sm text-slate-600">Please make sure the document contains readable text.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                    {notesContent || 'No content available'}
                  </pre>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
                    {notesContent ? `${notesContent.length} characters extracted` : 'No content'}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setViewingNotes(null)}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleGenerateFlashcardsFromNotes}
                      disabled={!notesContent || generatingFlashcards === viewingNotes?._id}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      {generatingFlashcards === viewingNotes?._id ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} className="mr-2" />
                          Generate Flashcards
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleGenerateQuizFromNotes}
                      disabled={!notesContent || generatingQuiz === viewingNotes?._id}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {generatingQuiz === viewingNotes?._id ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap size={16} className="mr-2" />
                          Generate Quiz
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}   