import { Router } from 'express';
import * as consumerReviewController from '../controllers/consumer-review.controller';

const router = Router();

router.get('/', consumerReviewController.getAllConsumerReviews);
router.get('/unprocessed', consumerReviewController.getUnprocessedReviews);
router.post('/:id/accept', consumerReviewController.acceptReview);
router.post('/:id/auto-accept', consumerReviewController.autoAcceptReview);
router.post('/:id/pending', consumerReviewController.pendingReview);
router.post('/:id/auto-reject', consumerReviewController.autoRejectReview);
router.post('/:id/reject', consumerReviewController.rejectReview);

export default router;
