import { ConsumerReviewRepository } from '../repositories/consumer-review.repository';
import { IConsumerReview, ReviewStatus } from '../models/consumer-review.model';

export class ConsumerReviewService {
  private repository: ConsumerReviewRepository;

  constructor() {
    this.repository = new ConsumerReviewRepository();
  }

  async getAllByDateRange(
    startDate: Date,
    endDate: Date,
    status?: ReviewStatus
  ): Promise<IConsumerReview[]> {
    return this.repository.getAllByDateRange(startDate, endDate, status);
  }

  async getById(id: number): Promise<IConsumerReview | null> {
    return this.repository.getById(id);
  }

  async acceptReview(id: number): Promise<IConsumerReview | null> {
    return this.repository.updateStatus(id, ReviewStatus.Accepted);
  }

  async rejectReview(id: number): Promise<IConsumerReview | null> {
    return this.repository.updateStatus(id, ReviewStatus.Rejected);
  }

  async autoAcceptReview(id: number): Promise<IConsumerReview | null> {
    return this.repository.updateStatus(id, ReviewStatus.AutoAccepted);
  }

  async pendingReview(id: number): Promise<IConsumerReview | null> {
    return this.repository.pendingReview(id);
  }

  async autoRejectReview(id: number): Promise<IConsumerReview | null> {
    return this.repository.autoRejectReview(id);
  }

  async getUnprocessed(
    pageSize: number,
    skipCount: number
  ): Promise<{ totalCount: number; items: IConsumerReview[] }> {
    return this.repository.getUnprocessed(pageSize, skipCount);
  }
}
