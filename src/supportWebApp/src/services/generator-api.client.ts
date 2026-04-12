import { AppConsts } from '../AppConsts';
import { ServiceProxy } from './ApiClient';

// ============= Interfaces =============

export interface GenerateTicketsInput {
  ticketsCount: number;
  theme: string;
}

// ============= Generator API Service =============

export class GeneratorApiService extends ServiceProxy {
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

// ============= Generator API Client =============

export class GeneratorApiClient {
  private static instance: GeneratorApiClient;
  public generate: GeneratorApiService;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.generate = new GeneratorApiService(this.baseUrl);
  }

  static getInstance(): GeneratorApiClient {
    if (!GeneratorApiClient.instance) {
      GeneratorApiClient.instance = new GeneratorApiClient(AppConsts.generatorApiBaseUrl);
    }
    return GeneratorApiClient.instance;
  }
}
