import type { Pin } from "./types";
import { getInitials } from "./types";

export const SEED_PINS: Omit<Pin, "id">[] = [
  {
    title: "Memorial Church mosaics",
    type: "guided",
    contextType: "architectural",
    guide: {
      name: "Antonio Paoletti",
      role: "Mosaic restorer",
      era: "1910s",
      relationship: "He helped rebuild the mosaics after the 1906 earthquake.",
      perspective:
        "Look closely — every stone here remembers a fall and a rebuilding. Most people see one wall. I see two, layered on top of each other.",
      type: "composite",
      avatarInitials: getInitials("Antonio Paoletti"),
      basedOn: "Italian mosaic craftsmen who rebuilt Stanford after 1906",
    },
    era: "1900s",
    lat: 37.4275,
    lng: -122.1711,
    contributor: { name: "Prof. Elena Voss", role: "Historian" },
    tags: ["Mission Revival", "Stanford founding", "Religious architecture"],
    upvotes: { accurate: 18, helpful: 43 },
    annotations: [
      {
        x: 50,
        y: 22,
        question:
          "Why might one section of the mosaic look newer than the rest?",
        answer:
          "The gold tessera on the left side were laid after 1906 — the original right side survived the earthquake, but the left wall came down. We had to source matching glass from Venice and pretend it was the same.",
        lookFirst: true,
        lookPrompt: "the mosaic above the entrance — compare the left and right sides",
        order: 0,
      },
      {
        x: 30,
        y: 65,
        question:
          "Can you spot where earthquake repairs used a slightly different stone?",
        answer:
          "The sandstone facade uses a warm buff color typical of Mission Revival, but the lower third was replaced with a slightly pinker stone after 1906. From a distance you don't see it. From here, you can't unsee it.",
        lookFirst: true,
        lookPrompt: "the lower portion of the facade",
        order: 1,
      },
      {
        x: 75,
        y: 80,
        question: "What happened between 1891 and 1903 that required rebuilding?",
        answer:
          "The cornerstone reads 1903, but Stanford was founded in 1891. Jane Stanford pushed the church through after Leland's death — and the original tower collapsed in the 1906 earthquake before it could even settle.",
        lookFirst: false,
        order: 2,
      },
    ],
    description:
      "Stanford Memorial Church is one of the most visited buildings on campus, but most people walk past without noticing the layers of rebuilding visible in its stone.",
    resources: [
      { label: "Stanford Archives — Church collection", type: "archive" },
      { label: "Mission Revival Architecture in California (book)", type: "book" },
    ],
    createdAt: new Date(),
  },
  {
    title: "The Cactus Garden's hidden origin",
    type: "story",
    contextType: "historical",
    guide: {
      name: "Leland Stanford Jr.",
      role: "Teenage botanist",
      era: "1880s",
      relationship: "He brought back cuttings from his Arizona trips and planted them here.",
      perspective:
        "This wasn't decoration. These plants are letters from a son to his parents — and a hobby that outlived him.",
      type: "historical",
      avatarInitials: getInitials("Leland Stanford Jr."),
    },
    era: "1880s",
    lat: 37.4265,
    lng: -122.1735,
    contributor: { name: "Maria Santos", role: "Local" },
    tags: ["Landscape architecture", "Stanford founding", "Leland Stanford Jr."],
    upvotes: { accurate: 7, helpful: 22 },
    annotations: [
      {
        x: 50,
        y: 50,
        question:
          "Who do you think planted the first cactus here, and why?",
        answer:
          "Leland Junior had a fascination with desert botany after trips through Arizona Territory in the 1880s. He collected cuttings and planted them on the family estate. The garden predates the university by years.",
        lookFirst: true,
        lookPrompt: "the oldest, gnarliest plants near the centre",
        order: 0,
      },
      {
        x: 30,
        y: 70,
        question:
          "What does this garden tell you about how the Stanfords built this place?",
        answer:
          "After Leland Junior died at 15, his parents kept his garden alive. The whole university is, in a way, a memorial to a kid who liked plants. This corner is the most literal version of that.",
        lookFirst: false,
        order: 1,
      },
    ],
    description:
      "Most people think the Cactus Garden is just decorative. But it was originally planted by Leland Stanford Jr. himself, who had a fascination with desert botany. The garden predates the university.",
    resources: [],
    createdAt: new Date(),
  },
  {
    title: "Where the oak grove stood",
    type: "memory",
    contextType: "personal",
    guide: {
      name: "James Whitfield",
      role: "Stanford class of '74",
      era: "1970s",
      relationship: "He studied under the oaks that used to stand right here.",
      perspective:
        "The trees that taught me are gone. But if you stand still and look at the ground, the campus tells you what it lost.",
      type: "self",
      avatarInitials: getInitials("James Whitfield"),
    },
    era: "1970s",
    lat: 37.4255,
    lng: -122.169,
    contributor: { name: "James Whitfield", role: "Alumnus" },
    tags: ["Campus life", "Environmental history", "Student activism"],
    upvotes: { accurate: 4, helpful: 15 },
    annotations: [
      {
        x: 50,
        y: 40,
        question:
          "Stand here and look around. What's missing that you wouldn't know was missing?",
        answer:
          "There used to be a massive oak grove right where you're standing. I studied under those trees in '74. They were cut down for the science building expansion. There was a student protest, but it didn't save them.",
        lookFirst: true,
        lookPrompt: "the open ground where the building meets the path",
        order: 0,
      },
      {
        x: 70,
        y: 75,
        question:
          "Can you find the trace? It's still here if you look at the ground.",
        answer:
          "If you look at the ground carefully near the east wall, you can still see where two stumps were paved over. The pavement bulges slightly. That's the only marker the grove has.",
        lookFirst: true,
        lookPrompt: "the pavement near the east wall",
        order: 1,
      },
    ],
    description:
      "There used to be a massive oak grove right here. They were cut down for a building expansion in the '70s. The pavement still remembers.",
    resources: [],
    createdAt: new Date(),
  },
  {
    title: "What is this symbol?",
    type: "request",
    contextType: "mystery",
    guide: {
      name: "The unsolved question",
      role: "Mystery",
      era: "Unknown",
      relationship: "Nobody knows what this is. That's the whole point.",
      perspective:
        "Some questions get more interesting the longer they go unanswered. Help solve this one — or sit with the not-knowing.",
      type: "composite",
      avatarInitials: "??",
      basedOn: "An open mystery from a passing explorer",
    },
    era: null,
    lat: 37.428,
    lng: -122.17,
    contributor: { name: "Traveling_Soph", role: "Explorer" },
    tags: [],
    upvotes: { accurate: 0, helpful: 3 },
    annotations: [
      {
        x: 48,
        y: 52,
        question:
          "What do you think this symbol means? Make at least two guesses as a group.",
        answer:
          "I found this carved into the base of a lamp post near the quad. It looks like intertwined letters but I can't make them out. Maybe initials? A class year? A maker's mark? I have no idea.",
        lookFirst: true,
        lookPrompt: "the carved symbol at the base of the lamp post",
        order: 0,
      },
    ],
    description:
      "Found this while walking around the Main Quad. Anyone know what it means?",
    resources: [],
    createdAt: new Date(),
  },
  {
    title: "Rodin sculpture garden — the casting debate",
    type: "guided",
    contextType: "architectural",
    guide: {
      name: "Auguste Rodin",
      role: "Sculptor",
      era: "1900s",
      relationship: "He made the originals — but he never saw these casts.",
      perspective:
        "A bronze cast from my mold is still my work. Or is it? Stand here and decide for yourself — but don't pretend the question is simple.",
      type: "historical",
      avatarInitials: getInitials("Auguste Rodin"),
    },
    era: "1980s",
    lat: 37.4322,
    lng: -122.1642,
    contributor: { name: "Art History Society", role: "Organisation" },
    tags: ["Public art", "Rodin", "Bronze casting", "Museum collections"],
    upvotes: { accurate: 12, helpful: 31 },
    annotations: [
      {
        x: 35,
        y: 40,
        question:
          "If a sculpture is cast after the artist's death from the original molds, is it still 'a Rodin'?",
        answer:
          "This is a posthumous cast of The Burghers of Calais. Rodin died in 1917 — this was cast in the 1980s from his original molds. Most of Stanford's Rodin collection is like this.",
        lookFirst: true,
        lookPrompt: "the figures' faces and the seam where the casting joins meet",
        order: 0,
      },
      {
        x: 65,
        y: 70,
        question: "What does the surface texture tell you about the age of a bronze?",
        answer:
          "Run your hand along the base (gently). The patina here is different from older casts in Paris — younger, less weathered, slightly greener. Bronzes age, even after they're cast.",
        lookFirst: true,
        lookPrompt: "the base — touch it, look at the patina",
        order: 1,
      },
    ],
    description:
      "Stanford's Rodin collection is one of the largest outside Paris, but almost all of it was cast decades after Rodin's death. This raises fascinating questions about authenticity.",
    resources: [
      { label: "Cantor Arts Center — free admission", type: "museum" },
      { label: "Rodin casting history (Stanford exhibit guide)", type: "guide" },
    ],
    createdAt: new Date(),
  },
];
