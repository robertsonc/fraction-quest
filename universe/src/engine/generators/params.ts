import type { ParamRange, TemplateSpec } from '../types';

type Params = TemplateSpec['params'];

export function intParam(params: Params, key: string, defMin: number, defMax: number): ParamRange {
  const v = params[key];
  if (v === undefined) return { min: defMin, max: defMax };
  if (typeof v === 'number') return { min: v, max: v };
  if (typeof v === 'object' && !Array.isArray(v) && Number.isSafeInteger(v.min) && Number.isSafeInteger(v.max) && v.min <= v.max) return v;
  throw new Error(`template param ${key} must be an int or {min,max}`);
}

export function strParam(params: Params, key: string, def: string): string {
  const v = params[key];
  if (v === undefined) return def;
  if (typeof v === 'string') return v;
  throw new Error(`template param ${key} must be a string`);
}

export function listParam(params: Params, key: string, def: string[]): string[] {
  const v = params[key];
  if (v === undefined) return def;
  if (Array.isArray(v)) return v;
  throw new Error(`template param ${key} must be a list`);
}
