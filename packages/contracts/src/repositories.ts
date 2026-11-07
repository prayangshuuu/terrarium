/**
 * @terrarium/contracts - repositories.ts
 *
 * Storage-independent repository interfaces for core domain entities.
 * Allows core orchestration logic to remain completely agnostic of underlying storage (SQLite, in-memory, Postgres, REST).
 * Aligns with PLAN.md Section 10.1 & 14 and architectural boundary requirements.
 */

import { type Result } from "./base.ts";
import {
  type DatabaseError,
  type DuplicateEntityError,
  type NotFoundError,
} from "./errors.ts";
import { type Task, type TaskPriority, type TaskStatus, type TaskStep } from "./tasks.ts";
import { type Execution } from "./execution.ts";
import { type Message, type Session } from "./session.ts";
import { type Artifact } from "./artifacts.ts";
import { type ApprovalRequest, type ApprovalStatus } from "./approvals.ts";
import { type DomainEvent } from "./events.ts";
import { type Report } from "./reports.ts";
import { type MemoryCategory, type MemoryItem } from "./memory.ts";
import { type AgentDepartment } from "./departments.ts";
import { type AgentProfile, type AgentProfileStatus } from "./agent.ts";
import { type TaskPlan, type PlanStatus, type TaskType, type RiskLevel } from "./planning.ts";

export interface TaskQueryOptions {
  readonly status?: TaskStatus;
  readonly department?: AgentDepartment;
  readonly parentTaskId?: string;
  readonly priority?: TaskPriority;
  readonly limit?: number;
  readonly offset?: number;
}

export interface TaskRepository {
  findById(id: string): Promise<Result<Task | null, DatabaseError>>;
  list(options?: TaskQueryOptions): Promise<Result<readonly Task[], DatabaseError>>;
  create(task: Task): Promise<Result<Task, DuplicateEntityError | DatabaseError>>;
  update(task: Task): Promise<Result<Task, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
}

export interface StepRepository {
  findById(id: string): Promise<Result<TaskStep | null, DatabaseError>>;
  listByTaskId(taskId: string): Promise<Result<readonly TaskStep[], DatabaseError>>;
  create(step: TaskStep): Promise<Result<TaskStep, DuplicateEntityError | DatabaseError>>;
  update(step: TaskStep): Promise<Result<TaskStep, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
}

export interface ExecutionRepository {
  findById(id: string): Promise<Result<Execution | null, DatabaseError>>;
  listByTaskId(taskId: string): Promise<Result<readonly Execution[], DatabaseError>>;
  create(execution: Execution): Promise<Result<Execution, DuplicateEntityError | DatabaseError>>;
  update(execution: Execution): Promise<Result<Execution, NotFoundError | DatabaseError>>;
}

export interface SessionRepository {
  findById(id: string): Promise<Result<Session | null, DatabaseError>>;
  list(limit?: number, offset?: number): Promise<Result<readonly Session[], DatabaseError>>;
  create(session: Session): Promise<Result<Session, DuplicateEntityError | DatabaseError>>;
  update(session: Session): Promise<Result<Session, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
  addMessage(message: Message): Promise<Result<Message, DuplicateEntityError | DatabaseError>>;
  getMessages(sessionId: string, limit?: number, offset?: number): Promise<Result<readonly Message[], DatabaseError>>;
}

export interface ArtifactRepository {
  findById(id: string): Promise<Result<Artifact | null, DatabaseError>>;
  listByTaskId(taskId: string): Promise<Result<readonly Artifact[], DatabaseError>>;
  create(artifact: Artifact): Promise<Result<Artifact, DuplicateEntityError | DatabaseError>>;
  update(artifact: Artifact): Promise<Result<Artifact, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
}

export interface ApprovalQueryOptions {
  readonly status?: ApprovalStatus;
  readonly taskId?: string;
  readonly toolId?: string;
  readonly requestedByAgentId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ApprovalRepository {
  findById(id: string): Promise<Result<ApprovalRequest | null, DatabaseError>>;
  listPending(): Promise<Result<readonly ApprovalRequest[], DatabaseError>>;
  listByTaskId(taskId: string): Promise<Result<readonly ApprovalRequest[], DatabaseError>>;
  list(options?: ApprovalQueryOptions): Promise<Result<readonly ApprovalRequest[], DatabaseError>>;
  create(approval: ApprovalRequest): Promise<Result<ApprovalRequest, DuplicateEntityError | DatabaseError>>;
  update(approval: ApprovalRequest): Promise<Result<ApprovalRequest, NotFoundError | DatabaseError>>;
}

export interface EventQueryOptions {
  readonly entityType?: string;
  readonly entityId?: string;
  readonly eventType?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface EventRepository {
  record(event: DomainEvent): Promise<Result<DomainEvent, DatabaseError>>;
  query(options?: EventQueryOptions): Promise<Result<readonly DomainEvent[], DatabaseError>>;
}

export interface ReportRepository {
  findById(id: string): Promise<Result<Report | null, DatabaseError>>;
  listByTaskId(taskId: string): Promise<Result<readonly Report[], DatabaseError>>;
  create(report: Report): Promise<Result<Report, DuplicateEntityError | DatabaseError>>;
  update(report: Report): Promise<Result<Report, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
}

export interface MemoryRepository {
  findById(id: string): Promise<Result<MemoryItem | null, DatabaseError>>;
  findByKey(category: MemoryCategory, key: string): Promise<Result<MemoryItem | null, DatabaseError>>;
  list(category?: MemoryCategory, includeArchived?: boolean): Promise<Result<readonly MemoryItem[], DatabaseError>>;
  create(item: MemoryItem): Promise<Result<MemoryItem, DuplicateEntityError | DatabaseError>>;
  update(item: MemoryItem): Promise<Result<MemoryItem, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
}

export interface AgentProfileQueryOptions {
  readonly department?: AgentDepartment;
  readonly status?: AgentProfileStatus;
  readonly tag?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AgentProfileRepository {
  findById(id: string): Promise<Result<AgentProfile | null, DatabaseError>>;
  findBySlug(slug: string): Promise<Result<AgentProfile | null, DatabaseError>>;
  list(options?: AgentProfileQueryOptions): Promise<Result<readonly AgentProfile[], DatabaseError>>;
  search(query: string, department?: AgentDepartment, limit?: number): Promise<Result<readonly AgentProfile[], DatabaseError>>;
  create(profile: AgentProfile): Promise<Result<AgentProfile, DuplicateEntityError | DatabaseError>>;
  update(profile: AgentProfile): Promise<Result<AgentProfile, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
  count(department?: AgentDepartment): Promise<Result<number, DatabaseError>>;
}

export interface PlanQueryOptions {
  readonly status?: PlanStatus;
  readonly taskId?: string;
  readonly taskType?: TaskType;
  readonly riskLevel?: RiskLevel;
  readonly limit?: number;
  readonly offset?: number;
}

export interface PlanRepository {
  findById(id: string): Promise<Result<TaskPlan | null, DatabaseError>>;
  findByTaskId(taskId: string): Promise<Result<TaskPlan | null, DatabaseError>>;
  list(options?: PlanQueryOptions): Promise<Result<readonly TaskPlan[], DatabaseError>>;
  create(plan: TaskPlan): Promise<Result<TaskPlan, DuplicateEntityError | DatabaseError>>;
  update(plan: TaskPlan): Promise<Result<TaskPlan, NotFoundError | DatabaseError>>;
  delete(id: string): Promise<Result<boolean, DatabaseError>>;
}

/**
 * Composite container for all domain repositories with transaction support.
 */
export interface TerrariumRepositories {
  readonly tasks: TaskRepository;
  readonly steps: StepRepository;
  readonly executions: ExecutionRepository;
  readonly sessions: SessionRepository;
  readonly artifacts: ArtifactRepository;
  readonly approvals: ApprovalRepository;
  readonly events: EventRepository;
  readonly reports: ReportRepository;
  readonly memory: MemoryRepository;
  readonly agentProfiles: AgentProfileRepository;
  readonly plans: PlanRepository;
  withTransaction<T>(operation: () => Promise<T>): Promise<Result<T, DatabaseError>>;
}
