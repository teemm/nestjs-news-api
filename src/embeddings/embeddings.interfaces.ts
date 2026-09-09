export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqItemWithScore extends FaqItem {
  score: number;
}
