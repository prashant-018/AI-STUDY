import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getStorageOverview } from '../controllers/documents.controller.js';

const router = Router();

router.get('/overview', authRequired, getStorageOverview);

export default router;


