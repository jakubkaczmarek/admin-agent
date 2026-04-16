export interface ApiResponse<T> {
  data: {
    result: T;
  };
}

export class ServiceProxy {
  protected baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    config?: RequestInit
  ): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers
      },
      body: data ? JSON.stringify(data) : undefined,
      ...config
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return { data: { result: result.data as T } };
  }

  protected async requestRaw<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    config?: RequestInit
  ): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers
      },
      body: data ? JSON.stringify(data) : undefined,
      ...config
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  protected getUrlWithParams(baseUrl: string, params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}
