// ---- Quiz Types ----
export type QuizPackT = { id: string; items: any[]; createdAt?: string };

export function isQuizPack(x: any): x is QuizPackT {
  return !!x && typeof x.id === "string" && Array.isArray(x.items);
}

// ---- Learning Outcome Alignment Types ----
export type LoLink = {
  lo_id: string;
  lo_title: string;
  confidence: number;
};

export type LoAlignedSegment = {
  index: number;
  text: string;
  lo_links: LoLink[];
};

export type LoAlignment = {
  segments: LoAlignedSegment[];
};
