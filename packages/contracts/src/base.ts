/**
 * @terrarium/contracts - base.ts
 *
 * Foundational primitive types, entity standards, and functional Result types.
 * Pure TypeScript: zero dependencies, JSON-serializable, platform-agnostic.
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
 * All timestamps are UTC ISO-8601 strings to guarantee JSON serializability.
 */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Generic pagination request parameters.
 */
export interface PaginationParams {
  readonly limit?: number;
  readonly offset?: number;
  readonly cursor?: string;
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

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
