/**
 * Typed access to the content bundle. Content is data (repo-root content/); this module only loads,
 * indexes and validates it. New worlds arrive as content, never as code here (DESIGN.md 2.3).
 */
import worldsJson from '../../../content/worlds.json';
import skillsNf from '../../../content/skills/nf.json';
import lessonsNf from '../../../content/lessons/nf.equiv.json';
import templatesNf from '../../../content/templates/nf.equiv.json';
import misconceptionsJson from '../../../content/misconceptions.json';
import castJson from '../../../content/cast.json';
import type { TemplateSpec } from '../engine/types';
import type { Graph } from '../engine/adaptive';
import type { ContentBundle, LessonSpec, MicroLessonSpec, MisconceptionSpec, SkillSpec, WorldSpec } from './types';
import { hasString } from './strings';
import { misconceptionIds } from '../engine/misconceptions/detect';
import { generatorNames } from '../engine/generators';

export const CONSTANTS = {
  /** DESIGN.md S1 default: a session counts for review scheduling only on a new calendar day. */
  reviewCountsDistinctDaysOnly: true,
  sessionIdleMinutes: 30,
} as const;

export const content: ContentBundle = {
  worlds: worldsJson as WorldSpec[],
  skills: skillsNf as SkillSpec[],
  lessons: (lessonsNf as { lessons: LessonSpec[] }).lessons,
  microLessons: (lessonsNf as { microLessons: MicroLessonSpec[] }).microLessons,
  templates: templatesNf as TemplateSpec[],
  misconceptions: misconceptionsJson as MisconceptionSpec[],
  cast: [...castJson.kids, ...castJson.animals, castJson.guide],
  constants: CONSTANTS,
};

const byId = <T extends { id: string }>(list: T[]): Map<string, T> => new Map(list.map((x) => [x.id, x]));

export const skills = byId(content.skills);
export const lessons = byId(content.lessons);
export const microLessons = byId(content.microLessons);
export const templates = byId(content.templates);
export const misconceptions = byId(content.misconceptions);
export const worlds = byId(content.worlds);

export function skill(id: string): SkillSpec {
  const s = skills.get(id);
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}
export function template(id: string): TemplateSpec {
  const t = templates.get(id);
  if (!t) throw new Error(`unknown template ${id}`);
  return t;
}
export function microLesson(id: string): MicroLessonSpec {
  const m = microLessons.get(id);
  if (!m) throw new Error(`unknown micro-lesson ${id}`);
  return m;
}
export function lessonFor(skillId: string): LessonSpec | null {
  const s = skill(skillId);
  return s.lesson ? lessons.get(s.lesson) ?? null : null;
}

/** The adaptive engine's view of the content. */
export const graph: Graph = {
  prereqsOf: (id) => skill(id).prereqs,
  skillMicroLesson: (id) => skill(id).microLesson,
  misconceptionMicroLesson: (id) => misconceptions.get(id)?.microLesson ?? null,
};

/** Structural checks run by the content lint test and at startup in dev. Returns problems, empty when clean. */
export function lintContent(): string[] {
  const problems: string[] = [];
  const gens = new Set(generatorNames());
  const preds = new Set(misconceptionIds());
  for (const s of content.skills) {
    for (const p of s.prereqs) if (!skills.has(p)) problems.push(`skill ${s.id}: unknown prereq ${p}`);
    if (s.lesson && !lessons.has(s.lesson)) problems.push(`skill ${s.id}: unknown lesson ${s.lesson}`);
    if (!microLessons.has(s.microLesson)) problems.push(`skill ${s.id}: unknown micro-lesson ${s.microLesson}`);
    for (const tId of s.itemTemplates) {
      const tpl = templates.get(tId);
      if (!tpl) problems.push(`skill ${s.id}: unknown template ${tId}`);
      else if (tpl.skillId !== s.id) problems.push(`template ${tId} belongs to ${tpl.skillId}, listed under ${s.id}`);
    }
    for (const m of s.misconceptions) if (!misconceptions.has(m)) problems.push(`skill ${s.id}: unknown misconception ${m}`);
    if (!worlds.has(s.world)) problems.push(`skill ${s.id}: unknown world ${s.world}`);
  }
  for (const tpl of content.templates) {
    if (!gens.has(tpl.generator)) problems.push(`template ${tpl.id}: unknown generator ${tpl.generator}`);
    if (!skills.has(tpl.skillId)) problems.push(`template ${tpl.id}: unknown skill ${tpl.skillId}`);
    for (const m of tpl.misconceptions) {
      if (!preds.has(m)) problems.push(`template ${tpl.id}: no predicate for ${m}`);
      if (!misconceptions.has(m)) problems.push(`template ${tpl.id}: ${m} missing from misconceptions.json`);
    }
  }
  for (const m of content.misconceptions) {
    if (!preds.has(m.id)) problems.push(`misconception ${m.id}: no predicate`);
    if (!hasString(m.labelKey)) problems.push(`misconception ${m.id}: missing string ${m.labelKey}`);
    if (!hasString(m.fixKey)) problems.push(`misconception ${m.id}: missing string ${m.fixKey}`);
    if (m.microLesson && !microLessons.has(m.microLesson)) problems.push(`misconception ${m.id}: unknown micro-lesson ${m.microLesson}`);
    for (const s of m.skills) if (!skills.has(s)) problems.push(`misconception ${m.id}: unknown skill ${s}`);
  }
  for (const l of content.lessons) {
    if (!skills.has(l.skillId)) problems.push(`lesson ${l.id}: unknown skill`);
    for (const tId of [l.hook.templateId, l.walkthrough.templateId, ...l.guided.templates, ...l.independent.templates, ...l.check.templates]) {
      if (!templates.has(tId)) problems.push(`lesson ${l.id}: unknown template ${tId}`);
    }
    if (l.check.count < 3 || l.check.count > 5) problems.push(`lesson ${l.id}: knowledge check must have 3 to 5 items`);
    const checkReps = new Set(l.check.templates.map((tId) => templates.get(tId)?.rep));
    if (checkReps.size < 2) problems.push(`lesson ${l.id}: knowledge check needs two representations`);
    if (!hasString(l.hook.captionKey)) problems.push(`lesson ${l.id}: missing string ${l.hook.captionKey}`);
  }
  for (const m of content.microLessons) {
    if (!skills.has(m.skillId)) problems.push(`micro-lesson ${m.id}: unknown skill`);
    if (!templates.has(m.walkthrough.templateId)) problems.push(`micro-lesson ${m.id}: unknown template`);
    if (m.quickCheck.templates.length !== 3) problems.push(`micro-lesson ${m.id}: quick check needs exactly 3 templates`);
    for (const tId of m.quickCheck.templates) if (!templates.has(tId)) problems.push(`micro-lesson ${m.id}: unknown template ${tId}`);
    if (m.misconceptionId && !misconceptions.has(m.misconceptionId)) problems.push(`micro-lesson ${m.id}: unknown misconception`);
    if (!hasString(m.titleKey)) problems.push(`micro-lesson ${m.id}: missing string ${m.titleKey}`);
  }
  for (const w of content.worlds) if (!hasString(w.titleKey)) problems.push(`world ${w.id}: missing string ${w.titleKey}`);
  return problems;
}

export const denylist: string[] = castJson.denylist;
