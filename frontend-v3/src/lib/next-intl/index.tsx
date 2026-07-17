"use client";

import * as React from "react";

type IntlContextValue = {
  locale: string;
  messages: IntlMessages;
};

const IntlContext = React.createContext<IntlContextValue>({
  locale: "ar",
  messages: {} as IntlMessages,
});

export function NextIntlClientProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: IntlMessages;
}) {
  return (
    <IntlContext.Provider value={{ locale, messages }}>
      {children}
    </IntlContext.Provider>
  );
}

export function useLocale() {
  return React.useContext(IntlContext).locale;
}

export function useMessages() {
  return React.useContext(IntlContext).messages;
}

export function useTranslations(namespace?: string) {
  const messages = useMessages();

  return React.useCallback(
    (key: string) => {
      const path = namespace ? `${namespace}.${key}` : key;
      const value = path.split(".").reduce<unknown>((current, part) => {
        if (current && typeof current === "object" && part in current) {
          return (current as Record<string, unknown>)[part];
        }
        return undefined;
      }, messages);

      return typeof value === "string" ? value : path;
    },
    [messages, namespace],
  );
}
