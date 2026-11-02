// Topic catalog (5 categories x 15 topics) captains choose from. The curated,
// medium-hard question pool lives in ./pool (re-exported here). When an
// Anthropic key is present the AI generator produces topic-tailored questions
// and replaces the pool (see regenerateTriviaBank).

export interface TopicCategory {
  category: string;
  topics: string[];
}

export const TOPIC_CATALOG: TopicCategory[] = [
  {
    category: "Sports",
    topics: ["Baseball", "Basketball", "NFL Football", "Soccer", "Tennis", "Golf", "Hockey", "Olympics", "Boxing", "Formula 1", "Cycling", "Swimming", "Track & Field", "College Sports", "Extreme Sports"],
  },
  {
    category: "Geography",
    topics: ["World Capitals", "US States", "Rivers & Lakes", "Mountains", "Oceans & Seas", "Deserts", "European Geography", "Asian Geography", "African Geography", "Flags", "Landmarks", "Islands", "Volcanoes", "Borders", "Map Trivia"],
  },
  {
    category: "Literature",
    topics: ["Shakespeare", "Classic Novels", "20th Century Fiction", "Poetry", "Children's Books", "Fantasy", "Sci-Fi", "Mystery & Crime", "Harry Potter", "Greek Mythology", "Famous Authors", "Banned Books", "Pulitzer Winners", "Modern Bestsellers", "First Lines"],
  },
  {
    category: "Entertainment",
    topics: ["Disney", "90s Movies", "Marvel", "Star Wars", "Sitcoms", "Pop Music", "Classic Rock", "Broadway", "Reality TV", "Video Games", "The Oscars", "Animated Films", "Horror Movies", "Streaming Shows", "Boy Bands"],
  },
  {
    category: "Science & Nature",
    topics: ["Space", "The Human Body", "Animals", "Chemistry", "Physics", "Geology", "Weather", "Dinosaurs", "Plants", "Inventions", "The Ocean", "Genetics", "Astronomy", "The Periodic Table", "Ecology"],
  },
];

// The curated question pool (300+ medium-hard, de-duped questions).
export { STARTER_POOL, type StarterQuestion } from "@/lib/trivia/pool";

export const CATEGORY_OF_TOPIC: Record<string, string> = Object.fromEntries(
  TOPIC_CATALOG.flatMap((c) => c.topics.map((t) => [t, c.category])),
);
