export type PinType = "guided" | "story" | "memory" | "request" | "observation";

export interface Annotation {
  x: number;
  y: number;
  note: string;
  question?: string | null;
  insight?: string | null;
}

export interface Resource {
  label: string;
  type: string;
}

export interface Pin {
  id: string;
  title: string;
  type: PinType;
  description: string;
  lat: number;
  lng: number;
  era: string | null;
  contributor: { name: string; role: string };
  tags: string[];
  upvotes: { accurate: number; helpful: number };
  annotations: Annotation[];
  resources: Resource[];
  createdAt: Date;
}

export const TYPE_ICONS: Record<PinType, string> = {
  guided: "\u{1F9ED}",
  story: "\u{1F4D6}",
  memory: "\u{1F4AD}",
  request: "\u2753",
  observation: "\u{1F50D}",
};

export const TYPE_LABELS: Record<PinType, string> = {
  guided: "Guided look",
  story: "Story",
  memory: "Memory",
  request: "Question",
  observation: "Observation",
};

export const ROLE_COLORS: Record<string, string> = {
  Historian: "#0C447C",
  Local: "#0F6E56",
  Alumnus: "#534AB7",
  Explorer: "#D85A30",
  Organisation: "#993556",
};

export const TYPE_COLORS: Record<PinType, string> = {
  guided: "#0C447C",
  story: "#0F6E56",
  memory: "#534AB7",
  request: "#D85A30",
  observation: "#6B5B3E",
};
