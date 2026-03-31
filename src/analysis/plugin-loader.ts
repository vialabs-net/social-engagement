import { logger } from '../utils/logger.js';
import type { CodeAnalyzer } from './types.js';

/**
 * Dynamically loads devcast plugin modules listed in config.plugins.
 *
 * Each plugin must be an npm package that exports a named `module` property
 * implementing CodeAnalyzer (from devcast-sdk).
 *
 * Failures are isolated: a plugin that fails to load is skipped with a warning.
 * The rest of the pipeline continues normally.
 */
export async function loadPlugins(pluginNames: readonly string[]): Promise<CodeAnalyzer[]> {
  if (pluginNames.length === 0) return [];

  const plugins: CodeAnalyzer[] = [];

  for (const name of pluginNames) {
    if (!isValidPackageName(name)) {
      logger.warn('plugin.invalid_name', { name });
      continue;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod: unknown = await import(name);
      const analyzer = extractAnalyzer(mod);

      if (!isValidAnalyzer(analyzer)) {
        logger.warn('plugin.invalid_export', {
          name,
          hint: 'plugin must export a named `module` property implementing CodeAnalyzer',
        });
        continue;
      }

      plugins.push(analyzer);
      logger.info('plugin.loaded', { name, id: analyzer.id });
    } catch (err) {
      logger.warn('plugin.load_failed', { name, error: String(err) });
    }
  }

  return plugins;
}

function isValidPackageName(name: string): boolean {
  // Allow scoped packages (@scope/name) and regular names (letters, digits, -, _, .)
  return /^(?:@[a-z0-9\-_.]+\/)?[a-z0-9\-_.]+$/i.test(name);
}

function extractAnalyzer(mod: unknown): unknown {
  if (!mod || typeof mod !== 'object') return undefined;
  const m = mod as Record<string, unknown>;
  // Named export `module` is the convention; fall back to default
  return m['module'] ?? m['default'];
}

function isValidAnalyzer(value: unknown): value is CodeAnalyzer {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['id'] === 'string' &&
    m['id'].length > 0 &&
    typeof m['name'] === 'string' &&
    typeof m['category'] === 'string' &&
    typeof m['analyze'] === 'function'
  );
}
