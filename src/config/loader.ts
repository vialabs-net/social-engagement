import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { ConfigSchema, type Config } from './schema.js';

let cached: Config | null = null;

export function loadConfig(configPath = 'config.yaml'): Config {
  if (cached) return cached;

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\n` +
      'Run: cp config.example.yaml config.yaml and fill in your values.'
    );
  }

  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parse(raw) as unknown;
  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid config:\n${issues}`);
  }

  cached = result.data;
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
