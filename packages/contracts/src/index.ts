/**
 * @terrarium/contracts
 *
 * Core domain contracts, lifecycle status unions, interfaces, and base types.
 * Pure TypeScript: zero runtime dependencies, UI-independent, provider-independent.
 */

export const CONTRACTS_PACKAGE_NAME = "@terrarium/contracts" as const;
export const CONTRACTS_VERSION = "0.1.0" as const;

/**
 * Standard workspace package information.
 */
export interface TerrariumPackageInfo {
  readonly name: string;
  readonly version: string;
  readonly role: string;
}

/**
 * Base persisted entity attributes.
 */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Standard execution lifecycle status.
 */
export type ExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

/**
 * High-level task status.
 */
export type TaskStatus =
  | "draft"
  | "intake"
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Agent role categorization across departments.
 */
export type AgentDepartment =
  | "executive"
  | "engineering"
  | "product"
  | "design"
  | "customer_intelligence"
  | "security"
  | "research"
  | "documentation"
  | "legal";

/**
 * Strongly typed Result type for predictable domain boundary operations.
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function fail<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}
