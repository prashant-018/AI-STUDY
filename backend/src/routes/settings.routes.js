import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getSettings,
  updateSettings,
  resetSettings,
  getSection,
} from '../controllers/settings.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

// Get all settings
router.get('/', getSettings);

// Get specific section
router.get('/:section', getSection);

// Update settings
router.put('/', updateSettings);

// Reset settings
router.post('/reset', resetSettings);

export default router;


