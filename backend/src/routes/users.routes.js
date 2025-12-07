import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { listUsers, getUser, updateUser, deleteUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/', authRequired, listUsers);
router.get('/:id', authRequired, getUser);
router.patch('/:id', authRequired, updateUser);
router.delete('/:id', authRequired, deleteUser);

export default router;



