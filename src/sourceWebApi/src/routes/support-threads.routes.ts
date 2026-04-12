import { Router } from 'express';
import * as supportThreadController from '../controllers/support-threads.controller';

const router = Router();

router.post('/', supportThreadController.createThread);
router.get('/', supportThreadController.getAllThreads);
router.delete('/', supportThreadController.deleteAllThreads);
router.get('/:supportThreadId', supportThreadController.getThreadById);
router.post('/:supportThreadId/messages', supportThreadController.createMessage);
router.post('/:supportThreadId/closed', supportThreadController.closeThread);

export default router;
