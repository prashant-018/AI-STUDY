import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  getResults,
  getResult,
  getStats,
  deleteResult,
} from '../controllers/resultController.js';

const router = Router();

// All routes require authentication
router.use(authRequired);

router.get('/stats', getStats);
router.get('/', getResults);
router.get('/:id', getResult);
router.delete('/:id', deleteResult);

export default router;


