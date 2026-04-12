import { Request, Response } from 'express';
import { ConsumerReviewService } from '../services/consumer-review.service';
import { ReviewStatus } from '../models/consumer-review.model';

const consumerReviewService = new ConsumerReviewService();

export async function getAllConsumerReviews(req: Request, res: Response): Promise<void> {
  const { startDate, endDate, status } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({
      success: false,
      error: 'startDate and endDate are required parameters',
    });
    return;
  }

  const startDateObj = new Date(startDate as string);
  const endDateObj = new Date(endDate as string);

  if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
    res.status(400).json({
      success: false,
      error: 'Invalid date format. Use YYYY-MM-DD format',
    });
    return;
  }

  let statusValue: ReviewStatus | undefined;

  if (status !== undefined) {
    const statusNum = parseInt(status as string, 10);

    if (isNaN(statusNum) || statusNum < 0 || statusNum > 5) {
      res.status(400).json({
        success: false,
        error: 'Status must be an integer between 0 and 5',
      });
      return;
    }

    statusValue = statusNum as ReviewStatus;
  }

  const reviews = await consumerReviewService.getAllByDateRange(
    startDateObj,
    endDateObj,
    statusValue
  );

  res.json({
    success: true,
    data: reviews,
  });
}

export async function acceptReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const reviewId = parseInt(id, 10);

  if (isNaN(reviewId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid review ID',
    });
    return;
  }

  const updatedReview = await consumerReviewService.acceptReview(reviewId);

  if (!updatedReview) {
    res.status(404).json({
      success: false,
      error: 'Review not found',
    });
    return;
  }

  res.json({
    success: true,
    data: updatedReview,
  });
}

export async function rejectReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const reviewId = parseInt(id, 10);

  if (isNaN(reviewId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid review ID',
    });
    return;
  }

  const updatedReview = await consumerReviewService.rejectReview(reviewId);

  if (!updatedReview) {
    res.status(404).json({
      success: false,
      error: 'Review not found',
    });
    return;
  }

  res.json({
    success: true,
    data: updatedReview,
  });
}

export async function autoAcceptReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const reviewId = parseInt(id, 10);

  if (isNaN(reviewId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid review ID',
    });
    return;
  }

  const updatedReview = await consumerReviewService.autoAcceptReview(reviewId);

  if (!updatedReview) {
    res.status(404).json({
      success: false,
      error: 'Review not found',
    });
    return;
  }

  res.json({
    success: true,
    data: updatedReview,
  });
}

export async function pendingReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const reviewId = parseInt(id, 10);

  if (isNaN(reviewId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid review ID',
    });
    return;
  }

  const updatedReview = await consumerReviewService.pendingReview(reviewId);

  if (!updatedReview) {
    res.status(404).json({
      success: false,
      error: 'Review not found',
    });
    return;
  }

  res.json({
    success: true,
    data: updatedReview,
  });
}

export async function autoRejectReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const reviewId = parseInt(id, 10);

  if (isNaN(reviewId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid review ID',
    });
    return;
  }

  const updatedReview = await consumerReviewService.autoRejectReview(reviewId);

  if (!updatedReview) {
    res.status(404).json({
      success: false,
      error: 'Review not found',
    });
    return;
  }

  res.json({
    success: true,
    data: updatedReview,
  });
}

export async function getUnprocessedReviews(req: Request, res: Response): Promise<void> {
  const { pageSize, skipCount } = req.query;

  const pageSizeNum = parseInt(pageSize as string, 10) || 10;
  const skipCountNum = parseInt(skipCount as string, 10) || 0;

  if (pageSizeNum <= 0 || skipCountNum < 0) {
    res.status(400).json({
      success: false,
      error: 'pageSize must be positive and skipCount must be non-negative',
    });
    return;
  }

  const result = await consumerReviewService.getUnprocessed(pageSizeNum, skipCountNum);

  const pageNumber = Math.floor(skipCountNum / pageSizeNum) + 1;

  res.json({
    success: true,
    data: {
      pageNumber,
      pageSize: pageSizeNum,
      totalCount: result.totalCount,
      items: result.items,
    },
  });
}
