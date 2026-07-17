export type LocalePrefix = "always" | "as-needed" | "never";

export type RoutingConfig<Locales extends readonly string[]> = {
  locales: Locales;
  defaultLocale: Locales[number];
  localePrefix?: LocalePrefix;
};

export function defineRouting<const Locales extends readonly string[]>(
  config: RoutingConfig<Locales>,
) {
  return {
    ...config,
    localePrefix: config.localePrefix ?? "always",
  };
}
