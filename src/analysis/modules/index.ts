/**
 * MODULE_REGISTRY — the single extension point for the analysis system.
 *
 * To add a new module:
 * 1. Create src/analysis/modules/your-module.ts implementing CodeAnalyzer
 * 2. Import it below and add it to MODULE_REGISTRY
 *
 * That's it. No other files change.
 */

import type { CodeAnalyzer } from '../types.js';
import { ComplexityModule }      from './complexity.js';
import { DesignPatternsModule }  from './design-patterns.js';
import { CleanCodeModule }       from './clean-code.js';
import { TypeSystemModule }      from './type-system.js';
import { IntegrationModule }     from './integration.js';
import { TestingModule }         from './testing.js';
import { AiAssistedModule }      from './ai-assisted.js';
import { PerformanceModule }     from './performance.js';
import { SecurityModule }        from './security.js';
import { ApiDesignModule }       from './api-design.js';
import { ErrorResilienceModule } from './error-resilience.js';

export const MODULE_REGISTRY: CodeAnalyzer[] = [
  new ComplexityModule(),
  new DesignPatternsModule(),
  new CleanCodeModule(),
  new TypeSystemModule(),
  new IntegrationModule(),
  new TestingModule(),
  new AiAssistedModule(),
  new PerformanceModule(),
  new SecurityModule(),
  new ApiDesignModule(),
  new ErrorResilienceModule(),
];
