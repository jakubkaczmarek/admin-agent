import { AppConsts } from '../AppConsts';
import { ServiceProxy } from './ApiClient';

// ============= Interfaces =============

export interface SupportThreadSummary {
  id: number;
  creatorUserName: string;
  createdOnDateTime: string;
  modifierUserName: string;
  modifiedOnDateTime: string;
  subject: string;
  category: string;
  status: ThreadStatus;
}

export interface SupportThread extends SupportThreadSummary {
  messages: SupportThreadMessage[];
}

export interface SupportThreadMessage {
  id: number;
  creatorUserName: string;
  createdOnDateTime: string;
  message: string;
}

export interface CreateSupportThreadInput {
  creatorUserName: string;
  subject: string;
  category?: string;
  message: string;
}

export interface AddThreadMessageInput {
  creatorUserName: string;
  message: string;
}

export interface PagedResultDto<T> {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: T[];
}

export enum ThreadStatus {
  Open = 0,
  Closed = 1
}

export interface GetThreadsInput {
  status?: ThreadStatus;
  pageIndex?: number;
  pageSize?: number;
}

// ============= Tickets API Service =============

export class TicketsApiService extends ServiceProxy {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  /**
   * Create a new support thread with the first message.
   */
  async createThread(input: CreateSupportThreadInput): Promise<SupportThreadSummary> {
    const response = await this.request<SupportThreadSummary>('POST', '/support-threads', input);
    return response.data.result;
  }

  /**
   * Add a message to an existing support thread.
   */
  async addMessage(supportThreadId: number, input: AddThreadMessageInput): Promise<SupportThreadMessage> {
    if (supportThreadId === null || supportThreadId === undefined) {
      throw new Error("The parameter 'supportThreadId' cannot be null or undefined.");
    }

    const response = await this.request<SupportThreadMessage>(
      'POST',
      `/support-threads/${supportThreadId}/messages`,
      input
    );
    return response.data.result;
  }

  /**
   * Close a support thread.
   */
  async closeThread(supportThreadId: number): Promise<void> {
    if (supportThreadId === null || supportThreadId === undefined) {
      throw new Error("The parameter 'supportThreadId' cannot be null or undefined.");
    }

    await this.request<void>('POST', `/support-threads/${supportThreadId}/closed`);
  }

  /**
   * Get a paged list of support threads with optional status filter.
   */
  async getThreads(input?: GetThreadsInput): Promise<PagedResultDto<SupportThreadSummary>> {
    const params: Record<string, any> = {};
    if (input?.status !== undefined && input?.status !== null) {
      params.status = input.status;
    }
    if (input?.pageIndex !== undefined && input?.pageIndex !== null) {
      params.pageIndex = input.pageIndex;
    }
    if (input?.pageSize !== undefined && input?.pageSize !== null) {
      params.pageSize = input.pageSize;
    }

    const url = this.getUrlWithParams('/support-threads', params);
    const response = await this.request<PagedResultDto<SupportThreadSummary>>('GET', url);
    return response.data.result;
  }

  /**
   * Get a full support thread with all messages.
   */
  async getThread(supportThreadId: number): Promise<SupportThread> {
    if (supportThreadId === null || supportThreadId === undefined) {
      throw new Error("The parameter 'supportThreadId' cannot be null or undefined.");
    }

    const response = await this.request<SupportThread>('GET', `/support-threads/${supportThreadId}`);
    return response.data.result;
  }

  /**
   * Delete all support threads.
   */
  async deleteAllThreads(): Promise<void> {
    await this.request<void>('DELETE', '/support-threads');
  }
}

// ============= Tickets API Client =============

export class TicketsApiClient {
  private static instance: TicketsApiClient;
  public threads: TicketsApiService;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.threads = new TicketsApiService(this.baseUrl);
  }

  static getInstance(): TicketsApiClient {
    if (!TicketsApiClient.instance) {
      TicketsApiClient.instance = new TicketsApiClient(AppConsts.ticketsApiBaseUrl);
    }
    return TicketsApiClient.instance;
  }
}
