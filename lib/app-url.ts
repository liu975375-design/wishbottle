export class AppConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigurationError";
  }
}

export function getAppBaseUrl(): string {
  const value = process.env.APP_BASE_URL?.trim();

  if (!value) {
    throw new AppConfigurationError("APP_BASE_URL is not configured.");
  }

  return value.replace(/\/+$/, "");
}

export function isSecureAppBaseUrl(): boolean {
  return getAppBaseUrl().startsWith("https://");
}
