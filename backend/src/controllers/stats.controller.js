import Note from '../models/Note.js';
import Summary from '../models/Summary.js';

/**
 * Get user statistics
 * GET /api/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get total notes count
    const totalNotes = await Note.countDocuments({ userId });

    // Get total summaries count
    const totalSummaries = await Summary.countDocuments({ userId });

    // Calculate total words from notes
    const notesAggregation = await Note.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalWords: { $sum: '$wordCount' } } },
    ]);
    const totalWords = notesAggregation[0]?.totalWords || 0;

    // Get subject breakdown
    const subjectBreakdown = await Note.aggregate([
      { $match: { userId, subject: { $exists: true, $ne: null } } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    const subjectMap = {};
    subjectBreakdown.forEach((item) => {
      subjectMap[item._id] = item.count;
    });

    // Get recent activity (last 10 summaries)
    const recentActivity = await Summary.find({ userId })
      .populate('noteId', 'title subject')
      .sort({ generatedAt: -1 })
      .limit(10)
      .select('summaryType summaryLength wordCount generatedAt noteId')
      .lean();

    const formattedActivity = recentActivity.map((activity) => ({
      summaryId: activity._id,
      noteTitle: activity.noteId?.title || 'Unknown',
      noteSubject: activity.noteId?.subject || null,
      summaryType: activity.summaryType,
      summaryLength: activity.summaryLength,
      wordCount: activity.wordCount,
      generatedAt: activity.generatedAt,
    }));

    // Get difficulty breakdown
    const difficultyBreakdown = await Note.aggregate([
      { $match: { userId } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]);

    const difficultyMap = {
      easy: 0,
      medium: 0,
      advanced: 0,
    };
    difficultyBreakdown.forEach((item) => {
      if (difficultyMap.hasOwnProperty(item._id)) {
        difficultyMap[item._id] = item.count;
      }
    });

    // Get summary type breakdown
    const summaryTypeBreakdown = await Summary.aggregate([
      { $match: { userId } },
      { $group: { _id: '$summaryType', count: { $sum: 1 } } },
    ]);

    const summaryTypeMap = {};
    summaryTypeBreakdown.forEach((item) => {
      summaryTypeMap[item._id] = item.count;
    });

    res.json({
      success: true,
      stats: {
        totalNotes,
        totalSummaries,
        totalWords,
        subjectBreakdown: subjectMap,
        difficultyBreakdown: difficultyMap,
        summaryTypeBreakdown: summaryTypeMap,
        recentActivity: formattedActivity,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics',
    });
  }
};



