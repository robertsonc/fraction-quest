import type { Rep, TemplateSpec } from '../engine/types';

export type WorldId = 'nf' | 'nbt' | 'oa' | 'md' | 'g';

export interface WorldSpec {
  id: WorldId;
  titleKey: string;
  status: 'open' | 'soon';
  /** Map anchor in a 1000 x 600 viewBox. */
  x: number;
  y: number;
  tint: string;
}

export interface SkillSpec {
  id: string;
  world: WorldId;
  title: string;
  ccss: string[];
  prereqs: string[];
  representations: Rep[];
  lesson: string | null;
  microLesson: string;
  itemTemplates: string[];
  misconceptions: string[];
  /** Map position inside the island, 0..1. */
  x: number;
  y: number;
  /** Phase 1 ships one full lesson; other nodes carry micro-lessons only. */
  status: 'open' | 'micro-only';
}

export interface WalkthroughSpec {
  /** Template whose trace is played. */
  templateId: string;
  reps: Rep[];
}

export interface LessonSpec {
  id: string;
  skillId: string;
  hook: { templateId: string; captionKey: string; durationMs: number };
  walkthrough: WalkthroughSpec;
  guided: { templates: string[]; count: number };
  independent: { templates: string[]; count: number };
  check: { templates: string[]; count: number };
}

export interface MicroLessonSpec {
  id: string;
  skillId: string;
  misconceptionId: string | null;
  titleKey: string;
  walkthrough: WalkthroughSpec;
  quickCheck: { templates: string[] };
}

export interface MisconceptionSpec {
  id: string;
  skills: string[];
  labelKey: string;
  fixKey: string;
  microLesson: string | null;
}

export interface ContentBundle {
  worlds: WorldSpec[];
  skills: SkillSpec[];
  lessons: LessonSpec[];
  microLessons: MicroLessonSpec[];
  templates: TemplateSpec[];
  misconceptions: MisconceptionSpec[];
  cast: string[];
  constants: { reviewCountsDistinctDaysOnly: boolean; sessionIdleMinutes: number };
}
