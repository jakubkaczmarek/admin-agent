import { SupportThreadRepository } from '../repositories/support-thread.repository';
import {
  ISupportThread,
  ISupportThreadMessage,
  ISupportThreadWithMessages,
  ISupportThreadFilter,
  IPagedSupportThreads,
} from '../models/support-thread.model';

export class SupportThreadService {
  private repository: SupportThreadRepository;

  constructor() {
    this.repository = new SupportThreadRepository();
  }

  async createThread(
    creatorUserName: string,
    subject: string,
    category: string | null | undefined,
    message: string
  ): Promise<ISupportThread> {
    return this.repository.create(creatorUserName, subject, category, message);
  }

  async createMessage(
    supportThreadId: number,
    creatorUserName: string,
    message: string
  ): Promise<ISupportThreadMessage> {
    return this.repository.createMessage(supportThreadId, creatorUserName, message);
  }

  async closeThread(id: number): Promise<ISupportThread | null> {
    return this.repository.closeThread(id);
  }

  async getAll(
    pageIndex: number,
    pageSize: number,
    filter: ISupportThreadFilter
  ): Promise<IPagedSupportThreads> {
    return this.repository.getAll(pageIndex, pageSize, filter);
  }

  async getById(id: number): Promise<ISupportThread | null> {
    return this.repository.getById(id);
  }

  async getByIdWithMessages(id: number): Promise<ISupportThreadWithMessages | null> {
    return this.repository.getByIdWithMessages(id);
  }

  async deleteAll(): Promise<void> {
    return this.repository.deleteAll();
  }
}
