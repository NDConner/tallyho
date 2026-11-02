// Domain types mirroring supabase/migrations/0001_init.sql.
// Hand-maintained for Phase 1.
// Phase 2 hook: replace with generated types via
//   `supabase gen types typescript --project-id <id> > src/lib/db.types.ts`

export type GroupStatus = "setup" | "ready" | "live" | "done";
export type GroupCategory =
  | "family"
  | "work"
  | "travel"
  | "church"
  | "friends"
  | "general"
  | "custom";
export type TeamAssignment = "random" | "admin";
export type FeudQuestionType =
  | "pick_person"
  | "likelihood"
  | "multiple_choice"
  | "open_text"
  | "guess_who"
  | "guess_what";

// Survey challenge kinds, as played live. "feud" covers all consensus types
// (pick_person/likelihood/multiple_choice/open_text — guess the group's top
// answer). The two targeted kinds are all-or-nothing.
export type SurveyKind = "feud" | "guess_who" | "guess_what";
export type QuestionSource = "recommended" | "admin";
export type TopicSource = "recommended" | "custom";
export type GameStatus = "setup" | "active" | "paused" | "done";
export type GamePhase = "feud" | "trivia";

export interface Group {
  id: string;
  created_by: string;
  name: string;
  category: GroupCategory;
  category_custom_desc: string | null;
  dynamic_note: string;
  join_code: string;
  num_teams: number;
  num_rounds: number;
  team_assignment: TeamAssignment;
  calibration_constant: number | null;
  consensus_threshold: number;
  status: GroupStatus;
  scheduled_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  group_id: string;
  name: string;
  team_index: number;
  crest_seed: string | null;
  captain_member_id: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  display_name: string;
  is_captain: boolean;
  is_playing: boolean; // false = "answer-only" guest (pickable, but not at game night)
  team_id: string | null;
  avatar_seed: string | null;
  created_at: string;
}

export interface FeudQuestion {
  id: string;
  group_id: string;
  prompt: string;
  type: FeudQuestionType;
  options: string[] | null;
  target_member_id: string | null; // guess_what: the single member who answers
  source: QuestionSource;
  ai_recommended: boolean;
  is_buffer: boolean;
  usable: boolean | null;
  consensus_score: number | null;
  top_bucket: string | null;
  created_at: string;
}

export interface FeudResponse {
  id: string;
  question_id: string;
  member_id: string;
  raw_answer: string;
  normalized_bucket: string | null;
  created_at: string;
}

export interface FeudQuestionAssignment {
  id: string;
  group_id: string;
  question_id: string;
  member_id: string;
  created_at: string;
}

export interface TriviaTopic {
  id: string;
  group_id: string;
  team_id: string | null;
  category: string;
  name: string;
  selected: boolean;
  source: TopicSource;
  created_at: string;
}

export interface TriviaQuestion {
  id: string;
  group_id: string;
  team_id: string;
  topic: string;
  prompt: string;
  correct_answer: string;
  accepted_variants: string[];
  point_value: number;
  round_no: number | null;
  used: boolean;
  created_at: string;
}

export interface GameSettings {
  feudSeconds: number;
  triviaSeconds: number;
}

export interface Game {
  id: string;
  group_id: string;
  status: GameStatus;
  num_teams: number;
  num_rounds: number;
  current_round: number;
  current_team_id: string | null;
  current_member_id: string | null;
  current_phase: GamePhase;
  settings: GameSettings;
  state: Record<string, unknown>;
  started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameScore {
  id: string;
  game_id: string;
  team_id: string;
  points: number;
}

// A feud vote tally bucket, used on reveal screens.
export interface VoteBucket {
  label: string;
  count: number;
}
