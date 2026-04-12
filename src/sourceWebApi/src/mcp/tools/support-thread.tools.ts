import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { SupportThreadService } from '../../services/support-thread.service';
import { SupportThreadStatus } from '../../models/support-thread.model';

const service = new SupportThreadService();

function supportThreadStatusFromString(value: 'active' | 'closed'): SupportThreadStatus {
  switch (value) {
    case 'active':
      return SupportThreadStatus.Active;
    case 'closed':
      return SupportThreadStatus.Closed;
    default:
      throw new Error(`Invalid status: ${value}`);
  }
}

function supportThreadStatusToString(status: SupportThreadStatus): string {
  switch (status) {
    case SupportThreadStatus.Active:
      return 'active';
    case SupportThreadStatus.Closed:
      return 'closed';
    default:
      return 'unknown';
  }
}

export function registerSupportThreadTools(server: McpServer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createThreadSchema: Record<string, any> = {
    creatorUserName: z.string(),
    subject: z.string(),
    category: z.string().optional(),
    message: z.string(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'create_support_thread',
    'Create a new support thread with an initial message',
    createThreadSchema,
    async ({ creatorUserName, subject, category, message }) => {
      try {
        const thread = await service.createThread(creatorUserName, subject, category || null, message);

        const data = {
          id: thread.id,
          creatorUserName: thread.creatorUserName,
          createdOnDateTime: thread.createdOnDateTime.toISOString(),
          modifierUserName: thread.modifierUserName,
          modifiedOnDateTime: thread.modifiedOnDateTime.toISOString(),
          subject: thread.subject,
          category: thread.category,
          status: supportThreadStatusToString(thread.status),
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMessageSchema: Record<string, any> = {
    supportThreadId: z.number().int().positive(),
    creatorUserName: z.string(),
    message: z.string(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'create_support_message',
    'Add a new message to an existing support thread',
    createMessageSchema,
    async ({ supportThreadId, creatorUserName, message }) => {
      try {
        const thread = await service.getById(supportThreadId);
        if (!thread) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Support thread with ID ${supportThreadId} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const threadMessage = await service.createMessage(supportThreadId, creatorUserName, message);

        const data = {
          id: threadMessage.id,
          supportThreadId: threadMessage.supportThreadId,
          creatorUserName: threadMessage.creatorUserName,
          createdOnDateTime: threadMessage.createdOnDateTime.toISOString(),
          message: threadMessage.message,
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closeThreadSchema: Record<string, any> = {
    supportThreadId: z.number().int().positive(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'close_support_thread',
    'Close a support thread (change status to closed)',
    closeThreadSchema,
    async ({ supportThreadId }) => {
      try {
        const thread = await service.closeThread(supportThreadId);
        if (!thread) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Support thread with ID ${supportThreadId} not found`,
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
          id: thread.id,
          creatorUserName: thread.creatorUserName,
          createdOnDateTime: thread.createdOnDateTime.toISOString(),
          modifierUserName: thread.modifierUserName,
          modifiedOnDateTime: thread.modifiedOnDateTime.toISOString(),
          subject: thread.subject,
          category: thread.category,
          status: supportThreadStatusToString(thread.status),
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getThreadsSchema: Record<string, any> = {
    pageIndex: z.number().int().nonnegative().optional().default(0),
    pageSize: z.number().int().positive().optional().default(20),
    status: z.string().optional(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'get_support_threads',
    'Get a paginated list of support threads with optional status filter',
    getThreadsSchema,
    async ({ pageIndex = 0, pageSize = 20, status }) => {
      try {
        const filter: { status?: SupportThreadStatus } = {};
        if (status) {
          filter.status = supportThreadStatusFromString(status as 'active' | 'closed');
        }

        const result = await service.getAll(pageIndex, pageSize, filter);

        const data = {
          pageIndex: result.pageIndex,
          pageSize: result.pageSize,
          totalCount: result.totalCount,
          data: result.data.map((thread) => ({
            id: thread.id,
            creatorUserName: thread.creatorUserName,
            createdOnDateTime: thread.createdOnDateTime.toISOString(),
            modifierUserName: thread.modifierUserName,
            modifiedOnDateTime: thread.modifiedOnDateTime.toISOString(),
            subject: thread.subject,
            category: thread.category,
            status: supportThreadStatusToString(thread.status),
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getThreadByIdSchema: Record<string, any> = {
    supportThreadId: z.number().int().positive(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'get_support_thread_by_id',
    'Get a full support thread with all its messages',
    getThreadByIdSchema,
    async ({ supportThreadId }) => {
      try {
        const thread = await service.getByIdWithMessages(supportThreadId);
        if (!thread) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Support thread with ID ${supportThreadId} not found`,
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
          id: thread.id,
          creatorUserName: thread.creatorUserName,
          createdOnDateTime: thread.createdOnDateTime.toISOString(),
          modifierUserName: thread.modifierUserName,
          modifiedOnDateTime: thread.modifiedOnDateTime.toISOString(),
          subject: thread.subject,
          category: thread.category,
          status: supportThreadStatusToString(thread.status),
          messages: thread.messages.map((msg) => ({
            id: msg.id,
            supportThreadId: msg.supportThreadId,
            creatorUserName: msg.creatorUserName,
            createdOnDateTime: msg.createdOnDateTime.toISOString(),
            message: msg.message,
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateThreadCategorySchema: Record<string, any> = {
    supportThreadId: z.number().int().positive(),
    category: z.string(),
    userName: z.string(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.tool(
    'update_thread_category',
    'Update the category of a support thread. Only allowed when userName is "SupportAgent". Adds an automatic message documenting the change.',
    updateThreadCategorySchema,
    async ({ supportThreadId, category, userName }) => {
      try {
        // Validate userName is exactly 'SupportAgent'
        if (userName !== 'SupportAgent') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: 'Only SupportAgent can update thread category',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Validate category is not empty
        if (!category || category.trim() === '') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: 'Category must be a non-empty string',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Check thread exists
        const thread = await service.getById(supportThreadId);
        if (!thread) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Support thread with ID ${supportThreadId} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Add message documenting the change
        await service.createMessage(
          supportThreadId,
          'SupportAgent',
          `SupportAgent changed category to "${category}"`
        );

        // Update the category
        const updatedThread = await service.updateCategory(supportThreadId, category, userName);
        if (!updatedThread) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: 'Failed to update thread category',
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
          id: updatedThread.id,
          creatorUserName: updatedThread.creatorUserName,
          createdOnDateTime: updatedThread.createdOnDateTime.toISOString(),
          modifierUserName: updatedThread.modifierUserName,
          modifiedOnDateTime: updatedThread.modifiedOnDateTime.toISOString(),
          subject: updatedThread.subject,
          category: updatedThread.category,
          status: supportThreadStatusToString(updatedThread.status),
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
