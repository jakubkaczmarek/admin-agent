import { AppConsts } from '../AppConsts';
import { ServiceProxy } from './ApiClient';

// ============= Interfaces =============

export interface GenerateTicketsInput {
  ticketsCount: number;
  theme: string;
}

// ============= API Services =============

export class SupportTicketsAgentApiService extends ServiceProxy {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  async generateTickets(input: GenerateTicketsInput): Promise<void> {
    await this.request<void>('POST', '/tickets/generate', input);
  }

  async categorizeTickets(allowedCategories?: string[]): Promise<void> {
    const payload = allowedCategories && allowedCategories.length > 0
      ? { allowedCategories }
      : undefined;
    await this.request<void>('POST', '/tickets/all/categorize', payload);
  }
  
  async autocompleteTickets(): Promise<void> {
    await this.request<void>('POST', '/tickets/all/autocomplete');
  }
}

// ============= Agent API Client =============

export class AgentApiClient {
  private static instance: AgentApiClient;
  public supportTickets: SupportTicketsAgentApiService;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.supportTickets = new SupportTicketsAgentApiService(this.baseUrl);
  }

  static getInstance(): AgentApiClient {
    if (!AgentApiClient.instance) {
      AgentApiClient.instance = new AgentApiClient(AppConsts.generatorApiBaseUrl);
    }
    return AgentApiClient.instance;
  }
}
