import { Request, Response } from 'express';
import { SupportThreadService } from '../services/support-thread.service';
import { SupportThreadStatus } from '../models/support-thread.model';

const supportThreadService = new SupportThreadService();

export async function createThread(req: Request, res: Response): Promise<void> {
  const { creatorUserName, subject, category, message } = req.body;

  if (!creatorUserName || !subject || !message) {
    res.status(400).json({ success: false, error: 'Missing required fields: creatorUserName, subject, message' });
    return;
  }

  try {
    const thread = await supportThreadService.createThread(creatorUserName, subject, category, message);
    res.json({ success: true, data: thread });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create thread' });
  }
}

export async function createMessage(req: Request, res: Response): Promise<void> {
  const { supportThreadId } = req.params;
  const threadId = parseInt(supportThreadId, 10);

  if (isNaN(threadId)) {
    res.status(400).json({ success: false, error: 'Invalid thread ID' });
    return;
  }

  const { creatorUserName, message } = req.body;

  if (!creatorUserName || !message) {
    res.status(400).json({ success: false, error: 'Missing required fields: creatorUserName, message' });
    return;
  }

  try {
    const thread = await supportThreadService.getById(threadId);
    if (!thread) {
      res.status(404).json({ success: false, error: 'Thread not found' });
      return;
    }

    const threadMessage = await supportThreadService.createMessage(threadId, creatorUserName, message);
    res.json({ success: true, data: threadMessage });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create message' });
  }
}

export async function closeThread(req: Request, res: Response): Promise<void> {
  const { supportThreadId } = req.params;
  const threadId = parseInt(supportThreadId, 10);

  if (isNaN(threadId)) {
    res.status(400).json({ success: false, error: 'Invalid thread ID' });
    return;
  }

  try {
    const thread = await supportThreadService.closeThread(threadId);
    if (!thread) {
      res.status(404).json({ success: false, error: 'Thread not found' });
      return;
    }

    res.json({ success: true, data: thread });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to close thread' });
  }
}

export async function getAllThreads(req: Request, res: Response): Promise<void> {
  const pageIndex = parseInt(req.query.pageIndex as string || '0', 10);
  const pageSize = parseInt(req.query.pageSize as string || '20', 10);
  const statusParam = req.query.status as string;

  const filter: { status?: SupportThreadStatus } = {};
  if (statusParam !== undefined) {
    const status = parseInt(statusParam, 10);
    if (!isNaN(status) && (status === SupportThreadStatus.Active || status === SupportThreadStatus.Closed)) {
      filter.status = status;
    }
  }

  try {
    const result = await supportThreadService.getAll(pageIndex, pageSize, filter);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch threads' });
  }
}

export async function getThreadById(req: Request, res: Response): Promise<void> {
  const { supportThreadId } = req.params;
  const threadId = parseInt(supportThreadId, 10);

  if (isNaN(threadId)) {
    res.status(400).json({ success: false, error: 'Invalid thread ID' });
    return;
  }

  try {
    const thread = await supportThreadService.getByIdWithMessages(threadId);
    if (!thread) {
      res.status(404).json({ success: false, error: 'Thread not found' });
      return;
    }

    res.json({ success: true, data: thread });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch thread' });
  }
}

export async function deleteAllThreads(req: Request, res: Response): Promise<void> {
  try {
    await supportThreadService.deleteAll();
    res.json({ success: true, data: { message: 'All threads and messages deleted successfully' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete all threads' });
  }
}
