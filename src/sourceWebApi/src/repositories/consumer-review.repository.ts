import sql from 'mssql';
import { getPool } from '../utils/db';
import { IConsumerReview, ReviewStatus } from '../models/consumer-review.model';

export class ConsumerReviewRepository {
  async getAllByDateRange(
    startDate: Date,
    endDate: Date,
    status?: ReviewStatus
  ): Promise<IConsumerReview[]> {
    const pool = await getPool();
    const request = pool.request();

    request.input('startDate', sql.DateTime2, startDate);
    request.input('endDate', sql.DateTime2, endDate);

    let query = `
      SELECT 
        Id,
        ClientId,
        DateTime,
        Rating,
        Comment,
        Status
      FROM ConsumerReviews
      WHERE DateTime >= @startDate AND DateTime <= @endDate
    `;

    if (status !== undefined) {
      request.input('status', sql.Int, status);
      query += ' AND Status = @status';
    }

    query += ' ORDER BY DateTime DESC';

    const result = await request.query(query);
    return result.recordset as IConsumerReview[];
  }

  async getById(id: number): Promise<IConsumerReview | null> {
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT 
        Id,
        ClientId,
        DateTime,
        Rating,
        Comment,
        Status
      FROM ConsumerReviews
      WHERE Id = @id
    `);

    return result.recordset[0] as IConsumerReview | null;
  }

  async updateStatus(id: number, status: ReviewStatus): Promise<IConsumerReview | null> {
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);
    request.input('status', sql.Int, status);

    await request.query(`
      UPDATE ConsumerReviews
      SET Status = @status
      WHERE Id = @id
    `);

    return this.getById(id);
  }

  async getUnprocessed(
    pageSize: number,
    skipCount: number
  ): Promise<{ totalCount: number; items: IConsumerReview[] }> {
    const pool = await getPool();

    const countResult = await pool.request().query(`
      SELECT COUNT(*) as totalCount
      FROM ConsumerReviews
      WHERE Status = ${ReviewStatus.New}
    `);

    const totalCount = countResult.recordset[0].totalCount as number;

    if (totalCount === 0) {
      return { totalCount, items: [] };
    }

    const request = pool.request();
    request.input('pageSize', sql.Int, pageSize);
    request.input('skipCount', sql.Int, skipCount);

    const result = await request.query(`
      SELECT
        Id,
        ClientId,
        DateTime,
        Rating,
        Comment,
        Status
      FROM ConsumerReviews
      WHERE Status = ${ReviewStatus.PendingReview}
      ORDER BY DateTime DESC
      OFFSET @skipCount ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `);

    return {
      totalCount,
      items: result.recordset as IConsumerReview[],
    };
  }

  async pendingReview(id: number): Promise<IConsumerReview | null> {
    return this.updateStatus(id, ReviewStatus.PendingReview);
  }

  async autoRejectReview(id: number): Promise<IConsumerReview | null> {
    return this.updateStatus(id, ReviewStatus.AutoRejected);
  }
}
