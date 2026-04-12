import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { ConsumerReviewService } from '../../services/consumer-review.service';
import { ReviewStatus } from '../../models/consumer-review.model';

const service = new ConsumerReviewService();

function reviewStatusFromString(
  value: 'new' | 'pending-review' | 'auto-accepted' | 'auto-rejected' | 'accepted' | 'rejected'
): ReviewStatus {
  switch (value) {
    case 'new':
      return ReviewStatus.New;
    case 'pending-review':
      return ReviewStatus.PendingReview;
    case 'auto-accepted':
      return ReviewStatus.AutoAccepted;
    case 'auto-rejected':
      return ReviewStatus.AutoRejected;
    case 'accepted':
      return ReviewStatus.Accepted;
    case 'rejected':
      return ReviewStatus.Rejected;
    default:
      throw new Error(`Invalid status: ${value}`);
  }
}

function reviewStatusToString(status: ReviewStatus): string {
  switch (status) {
    case ReviewStatus.New:
      return 'new';
    case ReviewStatus.PendingReview:
      return 'pending-review';
    case ReviewStatus.AutoAccepted:
      return 'auto-accepted';
    case ReviewStatus.AutoRejected:
      return 'auto-rejected';
    case ReviewStatus.Accepted:
      return 'accepted';
    case ReviewStatus.Rejected:
      return 'rejected';
    default:
      return 'unknown';
  }
}

interface IUnprocessedReview {
  Id: number;
  ClientId: number;
  DateTime: string;
  Rating: number;
  Comment: string;
  status: string;
}

interface IPaginatedResponse {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  items: IUnprocessedReview[];
}

export function registerConsumerReviewTools(server: McpServer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getReviewsSchema: Record<string, any> = {
    startDate: z.string(),
    endDate: z.string(),
    status: z.string().optional(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'get_reviews_by_date_range',
    'Get consumer reviews filtered by date range and optional status',
    getReviewsSchema,
    async ({ startDate, endDate, status }) => {
      try {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const reviewStatus = status
          ? reviewStatusFromString(status as 'new' | 'auto-accepted' | 'accepted' | 'rejected')
          : undefined;

        const reviews = await service.getAllByDateRange(start, end, reviewStatus);

        const data = reviews.map((review) => ({
          Id: review.Id,
          ClientId: review.ClientId,
          DateTime: review.DateTime.toISOString(),
          Rating: review.Rating,
          Comment: review.Comment,
          status: reviewStatusToString(review.Status),
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateReviewSchema: Record<string, any> = {
    id: z.number().int().positive(),
    status: z.string(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'update_review_status',
    'Update the status of a specific review',
    updateReviewSchema,
    async ({ id, status }) => {
      try {
        const reviewStatus = reviewStatusFromString(status as 'new' | 'pending-review' | 'auto-accepted' | 'auto-rejected' | 'accepted' | 'rejected');

        let updatedReview = null;

        switch (reviewStatus) {
          case ReviewStatus.PendingReview:
            updatedReview = await service.pendingReview(id);
            break;
          case ReviewStatus.AutoAccepted:
            updatedReview = await service.autoAcceptReview(id);
            break;
          case ReviewStatus.AutoRejected:
            updatedReview = await service.autoRejectReview(id);
            break;
          case ReviewStatus.Accepted:
            updatedReview = await service.acceptReview(id);
            break;
          case ReviewStatus.Rejected:
            updatedReview = await service.rejectReview(id);
            break;
          default:
            throw new Error(
              `Cannot update status to '${status}'. Supported statuses: 'pending-review', 'auto-accepted', 'auto-rejected', 'accepted', 'rejected'.`
            );
        }

        if (!updatedReview) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Review with ID ${id} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const data = {
          Id: updatedReview.Id,
          ClientId: updatedReview.ClientId,
          DateTime: updatedReview.DateTime.toISOString(),
          Rating: updatedReview.Rating,
          Comment: updatedReview.Comment,
          status: reviewStatusToString(updatedReview.Status),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoAcceptSchema: Record<string, any> = {
    id: z.number().int().positive(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'auto_accept_review',
    'Auto-accept a specific review (sets status to auto-accepted)',
    autoAcceptSchema,
    async ({ id }) => {
      try {
        const updatedReview = await service.autoAcceptReview(id);

        if (!updatedReview) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Review with ID ${id} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const data = {
          Id: updatedReview.Id,
          ClientId: updatedReview.ClientId,
          DateTime: updatedReview.DateTime.toISOString(),
          Rating: updatedReview.Rating,
          Comment: updatedReview.Comment,
          status: reviewStatusToString(updatedReview.Status),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingReviewSchema: Record<string, any> = {
    id: z.number().int().positive(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'pending_review',
    'Set a specific review to pending review status',
    pendingReviewSchema,
    async ({ id }) => {
      try {
        const updatedReview = await service.pendingReview(id);

        if (!updatedReview) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Review with ID ${id} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const data = {
          Id: updatedReview.Id,
          ClientId: updatedReview.ClientId,
          DateTime: updatedReview.DateTime.toISOString(),
          Rating: updatedReview.Rating,
          Comment: updatedReview.Comment,
          status: reviewStatusToString(updatedReview.Status),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoRejectSchema: Record<string, any> = {
    id: z.number().int().positive(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'auto_reject_review',
    'Auto-reject a specific review (sets status to auto-rejected)',
    autoRejectSchema,
    async ({ id }) => {
      try {
        const updatedReview = await service.autoRejectReview(id);

        if (!updatedReview) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Review with ID ${id} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const data = {
          Id: updatedReview.Id,
          ClientId: updatedReview.ClientId,
          DateTime: updatedReview.DateTime.toISOString(),
          Rating: updatedReview.Rating,
          Comment: updatedReview.Comment,
          status: reviewStatusToString(updatedReview.Status),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUnprocessedSchema: Record<string, any> = {
    pageSize: z.number().int().positive().optional().default(10),
    skipCount: z.number().int().nonnegative().optional().default(0),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'get_unprocessed_reviews',
    'Get unprocessed reviews with pagination (status = pending-review)',
    getUnprocessedSchema,
    async ({ pageSize = 10, skipCount = 0 }) => {
      try {
        const result = await service.getUnprocessed(pageSize, skipCount);

        const pageNumber = Math.floor(skipCount / pageSize) + 1;

        const data: IPaginatedResponse = {
          pageNumber,
          pageSize,
          totalCount: result.totalCount,
          items: result.items.map((review) => ({
            Id: review.Id,
            ClientId: review.ClientId,
            DateTime: review.DateTime.toISOString(),
            Rating: review.Rating,
            Comment: review.Comment,
            status: reviewStatusToString(review.Status),
          })),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
