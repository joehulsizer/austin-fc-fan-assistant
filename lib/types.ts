export type FanContext = {
  section?: number;
  dietary?: 'vegan' | 'vegetarian' | 'gluten-aware';
  language?: 'en' | 'es';
  origin?: string;
  food?: string;
  topic?: string;
  kickoffTime?: string;
  travelMinutes?: number;
  travelMode?: 'parking' | 'car' | 'rideshare' | 'rail' | 'bus' | 'bike' | 'walk' | 'all';
  eventKind?: 'match' | 'other';
  event?: { title: string; startsAt?: string; source?: string };
};

export type Source = { title: string; url: string; checkedAt?: string };
export type Card = { title: string; detail: string; href: string; label: string };
export type Action = { label: string; href: string };
export type ChatInput = {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: FanContext;
};
export type Grounding = {
  route: string;
  planner?: 'model' | 'fallback' | 'fixed';
  context: FanContext;
  facts: string[];
  sources: Source[];
  cards: Card[];
  actions?: Action[];
  parts?: { query: string; result: Grounding }[];
  answer?: string;
};
