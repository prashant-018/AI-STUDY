import UserSettings from '../models/UserSettings.js';

/**
 * Get user settings
 * GET /api/settings
 */
export const getSettings = async (req, res) => {
  try {
    let settings = await UserSettings.findOne({ userId: req.user._id });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await UserSettings.createDefault(req.user._id);
    }

    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message,
    });
  }
};

/**
 * Update user settings
 * PUT /api/settings
 */
export const updateSettings = async (req, res) => {
  try {
    const { profile, notifications, study, ai, privacy, appearance, security, storage } = req.body;

    let settings = await UserSettings.findOne({ userId: req.user._id });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await UserSettings.createDefault(req.user._id);
    }

    // Update only provided fields
    if (profile) {
      settings.profile = { ...settings.profile, ...profile };
    }
    if (notifications) {
      settings.notifications = { ...settings.notifications, ...notifications };
      // Deep merge for nested objects
      if (notifications.categories) {
        settings.notifications.categories = {
          ...settings.notifications.categories,
          ...notifications.categories,
        };
      }
      if (notifications.quietHours) {
        settings.notifications.quietHours = {
          ...settings.notifications.quietHours,
          ...notifications.quietHours,
        };
      }
    }
    if (study) {
      settings.study = { ...settings.study, ...study };
      if (study.difficulty) {
        settings.study.difficulty = study.difficulty;
      }
    }
    if (ai) {
      settings.ai = { ...settings.ai, ...ai };
    }
    if (privacy) {
      settings.privacy = { ...settings.privacy, ...privacy };
    }
    if (appearance) {
      settings.appearance = { ...settings.appearance, ...appearance };
    }
    if (security) {
      settings.security = { ...settings.security, ...security };
    }
    if (storage) {
      settings.storage = { ...settings.storage, ...storage };
    }

    settings.updatedAt = new Date();
    await settings.save();

    return res.json({
      success: true,
      message: 'Settings updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message,
    });
  }
};

/**
 * Reset settings to default
 * POST /api/settings/reset
 */
export const resetSettings = async (req, res) => {
  try {
    const { section } = req.body; // Optional: reset specific section

    let settings = await UserSettings.findOne({ userId: req.user._id });

    if (!settings) {
      settings = await UserSettings.createDefault(req.user._id);
    }

    if (section) {
      // Reset specific section to default
      const defaultSettings = new UserSettings({ userId: req.user._id });
      switch (section) {
        case 'profile':
          settings.profile = defaultSettings.profile;
          break;
        case 'notifications':
          settings.notifications = defaultSettings.notifications;
          break;
        case 'study':
          settings.study = defaultSettings.study;
          break;
        case 'ai':
          settings.ai = defaultSettings.ai;
          break;
        case 'privacy':
          settings.privacy = defaultSettings.privacy;
          break;
        case 'appearance':
          settings.appearance = defaultSettings.appearance;
          break;
        case 'security':
          settings.security = defaultSettings.security;
          break;
        case 'storage':
          settings.storage = defaultSettings.storage;
          break;
      }
    } else {
      // Reset all settings
      await UserSettings.deleteOne({ userId: req.user._id });
      settings = await UserSettings.createDefault(req.user._id);
    }

    settings.updatedAt = new Date();
    await settings.save();

    return res.json({
      success: true,
      message: section ? `${section} settings reset to default` : 'All settings reset to default',
      settings,
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset settings',
      error: error.message,
    });
  }
};

/**
 * Get specific settings section
 * GET /api/settings/:section
 */
export const getSection = async (req, res) => {
  try {
    const { section } = req.params;

    let settings = await UserSettings.findOne({ userId: req.user._id });

    if (!settings) {
      settings = await UserSettings.createDefault(req.user._id);
    }

    const sectionMap = {
      profile: settings.profile,
      notifications: settings.notifications,
      study: settings.study,
      ai: settings.ai,
      privacy: settings.privacy,
      appearance: settings.appearance,
      security: settings.security,
      storage: settings.storage,
    };

    if (!sectionMap[section]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section',
      });
    }

    return res.json({
      success: true,
      section,
      data: sectionMap[section],
    });
  } catch (error) {
    console.error('Error getting section:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch section',
      error: error.message,
    });
  }
};


