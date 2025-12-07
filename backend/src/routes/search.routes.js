import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { unifiedSearch } from '../controllers/search.controller.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

router.get('/', unifiedSearch);

export default router;

