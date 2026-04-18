import { AppConsts } from '../AppConsts';
import { ServiceProxy } from './ApiClient';

// ============= Interfaces =============

export interface GenerateTicketsInput {
  ticketsCount: number;
  theme: string;
}

export interface JobAcceptedResponse {
  jobId: string;
  status: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'idle' | 'active' | 'completed' | 'error';
  startTime: string | null;
  endTime: string | null;
  executionTime: number | null;
  result: any;
  error: string | null;
}

// ============= API Services =============

export class JobsApiService extends ServiceProxy {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  async getJob(jobId: string): Promise<JobStatusResponse> {
    return this.requestRaw<JobStatusResponse>('GET', `/jobs/${jobId}`);
  }
}

export class SupportTicketsAgentApiService extends ServiceProxy {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  async generateTickets(input: GenerateTicketsInput): Promise<JobAcceptedResponse> {
    return this.requestRaw<JobAcceptedResponse>('POST', '/tickets/generate', input);
  }

  async categorizeTickets(allowedCategories?: string[]): Promise<JobAcceptedResponse> {
    const payload = allowedCategories && allowedCategories.length > 0
      ? { allowedCategories }
      : undefined;
    return this.requestRaw<JobAcceptedResponse>('POST', '/tickets/all/categorize', payload);
  }

  async autocompleteTickets(): Promise<JobAcceptedResponse> {
    return this.requestRaw<JobAcceptedResponse>('POST', '/tickets/all/autocomplete');
  }

  async autoreplyTickets(): Promise<JobAcceptedResponse> {
    return this.requestRaw<JobAcceptedResponse>('POST', '/tickets/all/autoreply');
  }
}

// ============= Agent API Client =============

export class AgentApiClient {
  private static instance: AgentApiClient;
  public supportTickets: SupportTicketsAgentApiService;
  public jobs: JobsApiService;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.supportTickets = new SupportTicketsAgentApiService(this.baseUrl);
    this.jobs = new JobsApiService(this.baseUrl);
  }

  static getInstance(): AgentApiClient {
    if (!AgentApiClient.instance) {
      AgentApiClient.instance = new AgentApiClient(AppConsts.generatorApiBaseUrl);
    }
    return AgentApiClient.instance;
  }
}
