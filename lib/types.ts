export type FanContext = {
  section?: number;
  dietary?: 'vegan' | 'vegetarian' | 'gluten-aware';
  language?: 'en' | 'es';
  event?: { title: string; startsAt?: string; source?: string };
};

export type Source = { title: string; url: string; checkedAt?: string };
export type Card = { title: string; detail: string; href: string; label: string };
export type ChatInput = {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: FanContext;
};
export type Grounding = {
  route: string;
  context: FanContext;
  facts: string[];
  sources: Source[];
  cards: Card[];
  answer?: string;
};

