// No-op logger used if any imported module from ../../../src/analysis/modules/
// transitively requires a logger. Production logger lives in src/utils/logger.ts;
// we shim it here to keep the experiment isolated.

export const logger = {
  info: (_msg: string, _data?: unknown): void => { /* no-op */ },
  warn: (_msg: string, _data?: unknown): void => { /* no-op */ },
  error: (_msg: string, _data?: unknown): void => { /* no-op */ },
  debug: (_msg: string, _data?: unknown): void => { /* no-op */ },
};

export default logger;
