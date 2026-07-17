export type RequestConfigParams = {
  requestLocale?: Promise<string | undefined> | string | undefined;
};

export type RequestConfig = {
  locale: string;
  messages: IntlMessages;
};

export function getRequestConfig(
  loader: (params: RequestConfigParams) => Promise<RequestConfig> | RequestConfig,
) {
  return loader;
}

export function setRequestLocale(locale: string) {
  void locale;
  // Compatibility no-op until the real next-intl package is installed.
}
