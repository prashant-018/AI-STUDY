# Flashcards Study API Documentation

Complete backend API for the Flashcards Study feature, matching the interface shown in the image.

## Base URL
```
http://localhost:5000/api/flashcards
```

All endpoints require authentication (Bearer token or session cookie).

---

## 📊 Study Dashboard

### GET `/api/flashcards/study-dashboard`

Get comprehensive study dashboard data including cards, progress, and settings.

**Query Parameters:**
- `limit` (optional, default: 6) - Number of cards to return
- `filter` (optional, default: 'all') - Filter by category: `all`, `review`, `known`, `mastered`
- `subject` (optional) - Filter by subject/category
- `mode` (optional, default: 'standard') - Study mode: `standard`, `quick_review`, `exam_mode`
- `currentCardId` (optional) - ID of current card being studied

**Response:**
```json
{
  "success": true,
  "studyProgress": {
    "masteryProgress": 84,
    "knownCount": 0,
    "masteredCount": 0,
    "totalReviews": 33
  },
  "cardDetails": {
    "difficulty": "medium",
    "masteryLevel": 85,
    "reviewCount": 5,
    "lastReviewed": "2 hours ago",
    "nextReviewDate": "2024-01-15T10:00:00Z",
    "status": "review",
    "easeFactor": 2.5,
    "repetitions": 3
  },
  "cardCategories": {
    "all": 6,
    "review": 6,
    "known": 0,
    "mastered": 0
  },
  "cards": [
    {
      "_id": "...",
      "question": "What is photosynthesis?",
      "answer": "The process by which plants convert light energy into chemical energy...",
      "hint": "Think about plants and sunlight",
      "subject": "Biology",
      "category": "Biology",
      "difficulty": "medium",
      "tags": ["biology", "plants"],
      "status": "review",
      "masteryLevel": 85,
      "reviewCount": 5,
      "lastReviewDate": "2024-01-14T08:00:00Z",
      "nextReviewDate": "2024-01-15T10:00:00Z",
      "isCurrent": true
    }
  ],
  "studySettings": {
    "autoFlip": false,
    "showHints": true
  },
  "overview": {
    "totalCards": 6,
    "reviewCards": 6,
    "knownCards": 0,
    "masteredCards": 0,
    "masteryProgress": 0,
    "averageMastery": 42,
    "totalReviews": 33
  },
  "studyModes": {
    "standard": {
      "label": "Standard",
      "description": "Balanced study session",
      "cardsAvailable": 6
    },
    "quick_review": {
      "label": "Quick Review",
      "description": "Focus on due cards",
      "cardsAvailable": 6
    },
    "exam_mode": {
      "label": "Exam Mode",
      "description": "Intensive practice",
      "cardsAvailable": 6
    }
  }
}
```

---

## 📚 Get All Flashcards

### GET `/api/flashcards`

Get all flashcards for the authenticated user with optional filtering.

**Query Parameters:**
- `status` (optional) - Filter by status: `new`, `learning`, `review`, `known`, `mastered`
- `subject` (optional) - Filter by subject
- `difficulty` (optional) - Filter by difficulty: `easy`, `medium`, `advanced`
- `search` (optional) - Search in question, answer, subject, or tags

**Response:**
```json
{
  "success": true,
  "count": 6,
  "flashcards": [...]
}
```

---

## 🎯 Get Single Flashcard

### GET `/api/flashcards/:id`

Get a single flashcard by ID.

**Response:**
```json
{
  "success": true,
  "flashcard": {
    "_id": "...",
    "question": "What is photosynthesis?",
    "answer": "...",
    "hint": "...",
    "subject": "Biology",
    "difficulty": "medium",
    "status": "review",
    "masteryLevel": 85,
    "reviewCount": 5,
    ...
  }
}
```

---

## ➕ Create Flashcard

### POST `/api/flashcards`

Create a new flashcard.

**Request Body:**
```json
{
  "question": "What is photosynthesis?",
  "answer": "The process by which plants convert light energy into chemical energy",
  "hint": "Think about plants and sunlight",
  "subject": "Biology",
  "category": "Biology",
  "tags": ["biology", "plants"],
  "difficulty": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "flashcard": {...}
}
```

---

## ✏️ Update Flashcard

### PUT `/api/flashcards/:id`

Update an existing flashcard.

**Request Body:** (all fields optional)
```json
{
  "question": "Updated question",
  "answer": "Updated answer",
  "hint": "Updated hint",
  "subject": "Biology",
  "difficulty": "easy"
}
```

---

## 🗑️ Delete Flashcard

### DELETE `/api/flashcards/:id`

Delete a flashcard.

**Response:**
```json
{
  "success": true,
  "message": "Flashcard deleted successfully"
}
```

---

## 📝 Review Flashcard

### POST `/api/flashcards/:id/review`

Review a flashcard and update spaced repetition data.

**Request Body:**
```json
{
  "quality": 4,
  "responseTime": 5000
}
```

**Quality Scale (0-5):**
- 0 = Complete blackout
- 1 = Incorrect, but recognized
- 2 = Incorrect, but easy to recall
- 3 = Correct, but difficult
- 4 = Correct, with some hesitation
- 5 = Perfect response

**Response:**
```json
{
  "success": true,
  "flashcard": {...},
  "updated": {
    "status": "review",
    "nextReviewDate": "2024-01-16T10:00:00Z",
    "masteryLevel": 90
  }
}
```

---

## ✅ Mark as Known

### POST `/api/flashcards/:id/mark-known`

Mark a flashcard as "known" (mastery level 75%).

**Response:**
```json
{
  "success": true,
  "flashcard": {
    "status": "known",
    "masteryLevel": 75,
    ...
  }
}
```

---

## ⭐ Mark as Mastered

### POST `/api/flashcards/:id/mark-mastered`

Mark a flashcard as "mastered" (mastery level 100%).

**Response:**
```json
{
  "success": true,
  "flashcard": {
    "status": "mastered",
    "masteryLevel": 100,
    ...
  }
}
```

---

## 📅 Get Due Cards

### GET `/api/flashcards/due`

Get all cards due for review.

**Query Parameters:**
- `subject` (optional) - Filter by subject
- `limit` (optional, default: 50) - Maximum number of cards to return

**Response:**
```json
{
  "success": true,
  "count": 5,
  "cards": [...]
}
```

---

## ⚙️ Update Study Settings

### PUT `/api/flashcards/settings`

Update flashcard study settings (auto-flip, show hints, etc.).

**Request Body:**
```json
{
  "autoFlip": false,
  "showHints": true,
  "defaultMode": "standard",
  "cardsPerSession": 20
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "autoFlip": false,
    "showHints": true,
    "defaultMode": "standard",
    "cardsPerSession": 20
  }
}
```

---

## 🎓 Study Session Management

### Start Study Session
**POST** `/api/study-sessions/start`

Start a new study session.

**Request Body:**
```json
{
  "mode": "standard",
  "subject": "Biology",
  "settings": {
    "autoFlip": false,
    "showHints": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "_id": "...",
    "mode": "standard",
    "totalCards": 6,
    "settings": {...},
    "startTime": "2024-01-14T10:00:00Z"
  },
  "cards": [...]
}
```

### Update Session Progress
**POST** `/api/study-sessions/:id/progress`

Update progress during a study session.

**Request Body:**
```json
{
  "cardId": "...",
  "isCorrect": true,
  "quality": 4,
  "responseTime": 5000,
  "markedKnown": false,
  "markedMastered": false
}
```

### Complete Study Session
**POST** `/api/study-sessions/:id/complete`

Complete a study session and save results.

**Response:**
```json
{
  "success": true,
  "session": {
    "_id": "...",
    "isCompleted": true,
    "totalDuration": 300,
    "completionPercentage": 100,
    ...
  }
}
```

---

## 📊 Data Models

### Flashcard Status Values
- `new` - Newly created, not yet reviewed
- `learning` - Currently being learned (1-2 reviews)
- `review` - In regular review cycle (3-4 reviews)
- `known` - Well known (5-7 reviews, mastery 75%)
- `mastered` - Fully mastered (8+ reviews, mastery 100%)

### Study Modes
- `standard` - Balanced study across all cards
- `quick_review` - Focus on due cards only
- `exam_mode` - Intensive practice mode

### Difficulty Levels
- `easy` - Easy difficulty
- `medium` - Medium difficulty
- `advanced` - Advanced/hard difficulty

---

## 🔄 Spaced Repetition Algorithm

The backend uses the SM-2 (SuperMemo 2) algorithm for spaced repetition:

- **Ease Factor**: Starts at 2.5, adjusts based on performance
- **Intervals**: 1 day → 6 days → increasing intervals
- **Mastery Calculation**: Based on repetitions (0-100%)
- **Status Updates**: Automatically updated based on review performance

---

## 📝 Example Usage

### 1. Get Study Dashboard
```javascript
const response = await fetch('/api/flashcards/study-dashboard?filter=all&mode=standard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
```

### 2. Review a Card
```javascript
await fetch('/api/flashcards/123/review', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    quality: 4,
    responseTime: 5000
  })
});
```

### 3. Mark as Known
```javascript
await fetch('/api/flashcards/123/mark-known', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 4. Update Settings
```javascript
await fetch('/api/flashcards/settings', {
  method: 'PUT',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    autoFlip: true,
    showHints: false
  })
});
```

---

## ✅ Complete Backend Implementation

The backend is fully implemented with:
- ✅ Flashcard CRUD operations
- ✅ Spaced repetition algorithm (SM-2)
- ✅ Study session tracking
- ✅ Progress tracking (mastery, reviews)
- ✅ Study modes (Standard, Quick Review, Exam Mode)
- ✅ Card filtering (All, Review, Known, Mastered)
- ✅ Study settings management
- ✅ User progress aggregation
- ✅ Error handling and validation

All endpoints are production-ready and match the flashcards study interface requirements.
