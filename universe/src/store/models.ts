import type { AttemptSummary } from '../engine/mastery';
import type { SkillProgress } from '../engine/review';
import type { Rep } from '../engine/types';

export const SCHEMA_VERSION = 1;
export const DB_NAME = 'fqu';
export const MAX_PROFILES = 8;

export interface Settings {
  readAloud: boolean;
  dyslexiaFont: boolean;
  theme: 'auto' | 'light' | 'dark';
  reducedTransparency: boolean;
  reducedMotion: 'auto' | 'on';
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  readAloud: false,
  dyslexiaFont: false,
  theme: 'auto',
  /** Solid panels by default; the see-through glass look is opt-in (owner decision, Phase 1 review). */
  reducedTransparency: true,
  reducedMotion: 'auto',
  sound: true,
};

export interface Profile {
  id: string;
  nickname: string;
  avatarId: number;
  createdAt: number;
  lastSeenAt: number;
  settings: Settings;
}

export interface SkillState extends SkillProgress {
  profileId: string;
  skillId: string;
  updatedAt: number;
}

export type AttemptPhase = 'guided' | 'independent' | 'check' | 'practice' | 'quick' | 'return' | 'review' | 'easywin';

export interface Attempt {
  id?: number;
  profileId: string;
  skillId: string;
  templateId: string;
  seed: number;
  rep: Rep;
  correct: boolean;
  aided: boolean;
  guess: boolean;
  misconceptionId: string | null;
  /** The learner's answer as typed, for the coach example. */
  answerText: string;
  elapsedMs: number;
  phase: AttemptPhase;
  sessionId: string;
  at: number;
}

export interface Session {
  id: string;
  profileId: string;
  /** 1-based count of sessions for this profile. */
  index: number;
  /** Count of sessions that fell on a new calendar day; used for review scheduling when the flag is on. */
  dayIndex: number;
  dayKey: string;
  startedAt: number;
  lastActivityAt: number;
  attempts: number;
}

export interface Remediation {
  id?: number;
  profileId: string;
  skillId: string;
  path: string[];
  cause: string;
  outcome: 'returned' | 'coach-flag' | 'abandoned';
  at: number;
}

export interface MetaRecord {
  key: 'schema';
  version: number;
  createdAt: number;
  lastOpenedAt: number;
}

export interface ExportBundle {
  app: 'fqu';
  schema: number;
  exportedAt: number;
  profiles: Profile[];
  skillState: SkillState[];
  attempts: Attempt[];
  sessions: Session[];
  remediation: Remediation[];
}

export function summaryOf(a: Pick<Attempt, 'correct' | 'aided' | 'guess' | 'rep'>): AttemptSummary {
  return { correct: a.correct, aided: a.aided, guess: a.guess, rep: a.rep };
}
