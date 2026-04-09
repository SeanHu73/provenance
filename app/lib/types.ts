export type PinType = "guided" | "story" | "memory" | "request" | "observation";

export type ContextType =
  | "architectural"
  | "historical"
  | "community"
  | "personal"
  | "mystery";

export type GuideType = "historical" | "composite" | "self";

export interface Guide {
  name: string;
  role: string;
  era: string;
  relationship: string;
  perspective: string;
  type: GuideType;
  avatarInitials: string;
  basedOn?: string; // for composite characters
}

export interface Annotation {
  x: number;
  y: number;
  // V3 fields
  question?: string | null;
  answer?: string | null;
  lookFirst?: boolean;
  lookPrompt?: string;
  historicalPhotoUrl?: string | null;
  order?: number;
  // Legacy fields (kept for older pins in Firestore)
  note?: string;
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
  contextType?: ContextType;
  guide?: Guide;
  description: string;
  lat: number;
  lng: number;
  era: string | null;
  contributor: { name: string; role: string };
  tags: string[];
  upvotes: { accurate: number; helpful: number };
  annotations: Annotation[];
  resources: Resource[];
  photoUrl?: string | null;
  historicalPhotoUrl?: string | null;
  createdAt: Date;
}

export const ERA_OPTIONS = [
  "Pre-1850s", "1850s", "1860s", "1870s", "1880s", "1890s",
  "1900s", "1910s", "1920s", "1930s", "1940s", "1950s",
  "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s",
];

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

// ─── Context Types (drives the question journey) ────────────────────────────

export interface ContextTypeOption {
  id: ContextType;
  label: string;
  description: string;
  icon: string;
  defaultPinType: PinType;
}

export const CONTEXT_TYPES: ContextTypeOption[] = [
  {
    id: "architectural",
    label: "Architectural / Physical",
    description: "I want to explain what you can see in this building, structure, or landscape",
    icon: "\u{1F3DB}",
    defaultPinType: "guided",
  },
  {
    id: "historical",
    label: "Historical Event",
    description: "Something happened here that people should know about",
    icon: "\u{1F4DC}",
    defaultPinType: "story",
  },
  {
    id: "community",
    label: "Community / Cultural",
    description: "This place matters to a community and here's why",
    icon: "\u{1F465}",
    defaultPinType: "story",
  },
  {
    id: "personal",
    label: "Personal / Memory",
    description: "I have a personal connection to this place",
    icon: "\u{1F4AD}",
    defaultPinType: "memory",
  },
  {
    id: "mystery",
    label: "Mystery / Inquiry",
    description: "There's something here I find fascinating and want others to explore",
    icon: "\u2753",
    defaultPinType: "request",
  },
];

// ─── Guide Helpers ──────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
