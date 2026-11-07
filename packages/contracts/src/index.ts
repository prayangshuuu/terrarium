/**
 * @terrarium/contracts
 *
 * Core domain contracts, schemas, lifecycle status unions, interfaces, and base types.
 * Pure TypeScript: zero runtime dependencies, UI-independent, provider-independent.
 */

// Base entities & result primitives
export * from "./base.ts";

// Error hierarchy & validation issue models
export * from "./errors.ts";

// Lightweight schema validation helpers
export * from "./validation-helpers.ts";

// Domain models
export * from "./departments.ts";
export * from "./agent.ts";
export * from "./tasks.ts";
export * from "./planning.ts";
export * from "./orchestration.ts";
export * from "./execution.ts";
export * from "./session.ts";
export * from "./artifacts.ts";
export * from "./approvals.ts";
export * from "./events.ts";
export * from "./reports.ts";
export * from "./memory.ts";
export * from "./providers.ts";
export * from "./tools.ts";
export * from "./budget.ts";
export * from "./results.ts";
export * from "./repositories.ts";

// UI presentation and user-facing terminology
export * from "./ui.ts";
