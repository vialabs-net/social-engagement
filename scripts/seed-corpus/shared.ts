import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MODULE_REGISTRY } from '../../src/analysis/modules/index.js';

export const DEFAULT_FROZEN_CSV_PATH = 'seed-articles-frozen.csv';
export const DEFAULT_SEED_JSON_PATH = 'seed-articles.json';
export const DEFAULT_FAILURES_JSON_PATH = 'seed-extraction-failures.json';
export const DEFAULT_SEED_SOURCE_NAME = 'curated-seed';
export const DEFAULT_SEED_WEEK_OF = '2026-01-01';
export const DEFAULT_CLASSIFIER_MODEL = 'claude-haiku-4-5';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

export interface FrozenCsvRow {
  readonly id: string;
  readonly track: string;
  readonly module_primary: string;
  readonly module_secondary: string;
  readonly url: string;
  readonly title: string;
  readonly source_name: string;
  readonly author: string;
  readonly published_date: string;
  readonly quality_score: string;
  readonly why_kept: string;
  readonly status: string;
  readonly reject_reason: string;
  readonly notes: string;
}

export interface SeedArticle {
  readonly url: string;
  readonly title: string;
  readonly source_name: string;
  readonly text: string;
  readonly quality_score: number;
  readonly modules: string[];
}

export interface SeedExtractionFailure {
  readonly id: string;
  readonly url: string;
  readonly reason: string;
}

const REQUIRED_CSV_HEADERS = [
  'id',
  'track',
  'module_primary',
  'module_secondary',
  'url',
  'title',
  'source_name',
  'author',
  'published_date',
  'quality_score',
  'why_kept',
  'status',
  'reject_reason',
  'notes',
] as const;

export const MODULE_IDS = MODULE_REGISTRY.map((module) => module.id).sort();
const MODULE_ID_SET = new Set(MODULE_IDS);

export function resolveCliPath(flagValue: string | undefined, fallbackPath: string): string {
  return resolve(process.cwd(), flagValue ?? fallbackPath);
}

export function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

export function parseInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer, received "${value}"`);
  }
  return parsed;
}

export function readFrozenCsv(filePath: string): FrozenCsvRow[] {
  const csv = readFileSync(filePath, 'utf8');
  const rows = parseCsv(csv);
  const headerRow = rows[0];
  if (!headerRow) {
    throw new Error(`CSV is empty: ${filePath}`);
  }

  const headers = headerRow.map((header, index) => {
    const cleanHeader = header.trim();
    return index === 0 ? cleanHeader.replace(/^\uFEFF/, '') : cleanHeader;
  });

  for (const header of REQUIRED_CSV_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`CSV is missing required header "${header}"`);
    }
  }

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const record = Object.fromEntries(
        headers.map((header, index) => [header, row[index]?.trim() ?? '']),
      ) as Record<string, string>;

      return {
        id: record['id'] ?? '',
        track: record['track'] ?? '',
        module_primary: record['module_primary'] ?? '',
        module_secondary: record['module_secondary'] ?? '',
        url: record['url'] ?? '',
        title: record['title'] ?? '',
        source_name: record['source_name'] ?? '',
        author: record['author'] ?? '',
        published_date: record['published_date'] ?? '',
        quality_score: record['quality_score'] ?? '',
        why_kept: record['why_kept'] ?? '',
        status: record['status'] ?? '',
        reject_reason: record['reject_reason'] ?? '',
        notes: record['notes'] ?? '',
      };
    });
}

export function loadSeedArticles(filePath: string): SeedArticle[] {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`Seed JSON must be an array: ${filePath}`);
  }

  return raw.map((item, index) => normalizeSeedArticle(item, index));
}

export function parseModuleList(value: string): string[] {
  return value
    .split(',')
    .map((moduleId) => moduleId.trim())
    .filter((moduleId) => moduleId.length > 0);
}

export function normalizeModules(modules: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const moduleId of modules.map((value) => value.trim()).filter((value) => value.length > 0)) {
    if (seen.has(moduleId)) continue;
    seen.add(moduleId);
    normalized.push(moduleId);
  }

  return normalized;
}

export function modulesFromRow(row: FrozenCsvRow): string[] {
  return normalizeModules([
    row.module_primary,
    ...parseModuleList(row.module_secondary),
  ]);
}

export function assertKnownModules(modules: string[], label: string): void {
  const invalid = modules.filter((moduleId) => !MODULE_ID_SET.has(moduleId));
  if (invalid.length > 0) {
    throw new Error(`${label} has unknown modules: ${invalid.join(', ')}`);
  }
}

export function buildCoverageCounts(articles: SeedArticle[]): Map<string, number> {
  const coverage = new Map(MODULE_IDS.map((moduleId) => [moduleId, 0]));

  for (const article of articles) {
    for (const moduleId of normalizeModules(article.modules)) {
      coverage.set(moduleId, (coverage.get(moduleId) ?? 0) + 1);
    }
  }

  return coverage;
}

function normalizeSeedArticle(item: unknown, index: number): SeedArticle {
  if (!item || typeof item !== 'object') {
    throw new Error(`Seed article at index ${index} is not an object`);
  }

  const record = item as Record<string, unknown>;
  const modules = Array.isArray(record['modules']) ? normalizeModules(record['modules'].map(String)) : [];

  return {
    url: String(record['url'] ?? ''),
    title: String(record['title'] ?? ''),
    source_name: String(record['source_name'] ?? ''),
    text: String(record['text'] ?? ''),
    quality_score: Number(record['quality_score']),
    modules,
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!char) continue;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error('CSV parsing failed: unclosed quoted field');
  }

  return rows;
}
