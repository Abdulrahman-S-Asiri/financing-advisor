import arMessages from "../messages/ar.json";

type Messages = typeof arMessages;

declare global {
  type IntlMessages = Messages;
}

export {};
