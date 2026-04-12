import { AppConsts } from '../AppConsts';
import { ServiceProxy } from './ApiClient';

// ============= Interfaces =============

export interface GenerateTicketsInput {
  ticketsCount: number;
  theme: string;
}

// ============= API Services =============

export class AgentTicketGeneratorApiService extends ServiceProxy {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  /**
   * Generate test tickets based on the specified count and theme.
   */
  async generateTickets(input: GenerateTicketsInput): Promise<void> {
    await this.request<void>('POST', '/tickets/generate', input);
  }
}

export class AgentTicketCategorizationApiService extends ServiceProxy {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  /**
   * Categorizes tickets with no category.
   * @param allowedCategories - Optional array of category names to restrict categorization. If provided with at least one value, it will be sent in the request body.
   */
  async categorizeTickets(allowedCategories?: string[]): Promise<void> {
    const payload = allowedCategories && allowedCategories.length > 0
      ? { allowedCategories }
      : undefined;
    await this.request<void>('POST', '/tickets/all/categorize', payload);
  }
}

// ============= Agent API Client =============

export class AgentApiClient {
  private static instance: AgentApiClient;
  public generate: AgentTicketGeneratorApiService;
  public categorize: AgentTicketCategorizationApiService;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.generate = new AgentTicketGeneratorApiService(this.baseUrl);
    this.categorize = new AgentTicketCategorizationApiService(this.baseUrl);
  }

  static getInstance(): AgentApiClient {
    if (!AgentApiClient.instance) {
      AgentApiClient.instance = new AgentApiClient(AppConsts.generatorApiBaseUrl);
    }
    return AgentApiClient.instance;
  }
}
