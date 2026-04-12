const BaseConfig: Record<string, string> = {
  TICKETS_API_BASE_URL: 'http://localhost:3000',
  GENERATOR_API_BASE_URL: 'http://localhost:3001'
};

const getAppConfigOrDefaultValue = (key: string): string => {
  const defaultValue: string = BaseConfig[key];

  if (!window || !(window as any).__APP_CONFIG__) {
    return defaultValue;
  }

  const appConfig: any = (window as any).__APP_CONFIG__;
  const appConfigValue: string | undefined = appConfig[key];
  return appConfigValue ?? defaultValue;
}

export const AppConsts = {
  appBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  ticketsApiBaseUrl: getAppConfigOrDefaultValue('TICKETS_API_BASE_URL'),
  generatorApiBaseUrl: getAppConfigOrDefaultValue('GENERATOR_API_BASE_URL')
};
