// Feud "subject": what a pick-a-person question's answers are drawn from.
//   • group (default) — the people in the group (today's behavior)
//   • theme           — a fixed pool of entities (athletes, Disney characters, …)
// Stored on groups.feud_subject (jsonb); absent/invalid = group mode. Plain TS
// (no server deps) so the editor, the join flow and server actions all share it.

export interface FeudSubject {
  mode: "group" | "theme";
  theme: string | null; // label when themed, e.g. "Athletes"
  pool: string[]; // entities to pick from when themed (empty for group mode)
}

export interface BuiltinSubject {
  key: string;
  label: string;
  emoji: string;
  pool: string[];
}

/** Curated starter themes. The host can also enter a fully custom list. */
export const BUILTIN_SUBJECTS: BuiltinSubject[] = [
  {
    key: "athletes",
    label: "Athletes",
    emoji: "🏅",
    pool: [
      "LeBron James", "Serena Williams", "Tom Brady", "Lionel Messi", "Cristiano Ronaldo",
      "Simone Biles", "Usain Bolt", "Michael Jordan", "Steph Curry", "Tiger Woods",
      "Michael Phelps", "Roger Federer", "Shaquille O'Neal", "Kobe Bryant", "Patrick Mahomes",
      "Shohei Ohtani", "Caitlin Clark", "Connor McDavid", "Katie Ledecky", "Megan Rapinoe",
    ],
  },
  {
    key: "disney",
    label: "Disney characters",
    emoji: "🏰",
    pool: [
      "Mickey Mouse", "Elsa", "Simba", "Woody", "Buzz Lightyear", "Ariel", "Mulan", "Aladdin",
      "Genie", "Moana", "Maui", "Olaf", "Stitch", "Belle", "Cinderella", "Donald Duck",
      "Goofy", "Peter Pan", "Tinker Bell", "Jack Sparrow",
    ],
  },
  {
    key: "superheroes",
    label: "Superheroes",
    emoji: "🦸",
    pool: [
      "Iron Man", "Captain America", "Spider-Man", "Batman", "Superman", "Wonder Woman",
      "Thor", "Hulk", "Black Widow", "Black Panther", "Doctor Strange", "Wolverine",
      "Deadpool", "The Flash", "Aquaman", "Captain Marvel", "Scarlet Witch", "Loki",
      "Groot", "Star-Lord",
    ],
  },
  {
    key: "movie_characters",
    label: "Movie characters",
    emoji: "🎬",
    pool: [
      "Darth Vader", "Forrest Gump", "Hermione Granger", "Harry Potter", "Gandalf",
      "Indiana Jones", "The Joker", "Katniss Everdeen", "Rocky Balboa", "Marty McFly",
      "Ferris Bueller", "Elle Woods", "James Bond", "Gollum", "Shrek", "Dorothy Gale",
      "Tony Stark", "Michael Scott", "Walter White", "Dwight Schrute",
    ],
  },
  {
    key: "pop_stars",
    label: "Pop stars",
    emoji: "🎤",
    pool: [
      "Taylor Swift", "Beyoncé", "Drake", "Rihanna", "Adele", "Bad Bunny", "Billie Eilish",
      "Harry Styles", "Ariana Grande", "Justin Bieber", "Dua Lipa", "The Weeknd", "Lady Gaga",
      "Bruno Mars", "Kendrick Lamar", "Olivia Rodrigo", "Post Malone", "SZA", "Ed Sheeran", "Doja Cat",
    ],
  },
];

export function builtinSubject(key: string): BuiltinSubject | null {
  return BUILTIN_SUBJECTS.find((s) => s.key === key) ?? null;
}

/** Clean a free-form list of entity names (newline- or comma-separated input is
 *  split by the caller; this trims, drops blanks, de-dupes, and caps length). */
export function cleanPool(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const v = String(e ?? "").trim().slice(0, 60);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 200) break;
  }
  return out;
}

/** Coerce whatever is stored on the group into a valid FeudSubject. Anything
 *  missing or malformed falls back to group mode (the classic behavior). */
export function normalizeFeudSubject(raw: unknown): FeudSubject {
  if (raw && typeof raw === "object") {
    const r = raw as { mode?: unknown; theme?: unknown; pool?: unknown };
    if (r.mode === "theme") {
      const pool = cleanPool(r.pool);
      if (pool.length >= 2) {
        const theme = typeof r.theme === "string" && r.theme.trim() ? r.theme.trim().slice(0, 40) : "Theme";
        return { mode: "theme", theme, pool };
      }
    }
  }
  return { mode: "group", theme: null, pool: [] };
}
