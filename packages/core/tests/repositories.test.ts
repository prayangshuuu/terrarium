import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  DuplicateEntityError,
  ForeignKeyConstraintError,
  type Task,
  type TaskStep,
  type Execution,
  type Session,
  type Message,
  type Artifact,
  type ApprovalRequest,
  type DomainEvent,
  type Report,
  type MemoryItem,
} from "@terrarium/contracts";
import { createSqliteDatabase, SqliteDatabase } from "../src/persistence/sqlite-database.ts";

describe("SQLite Repositories Integration Suite", () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = createSqliteDatabase(":memory:");
    const initRes = db.initialize();
    expect(initRes.success).toBe(true);
  });

  afterEach(() => {
    db.close();
  });

  describe("TaskRepository", () => {
    const sampleTask: Task = {
      id: "task_01",
      title: "Design storage schema",
      description: "Implement SQLite schema for core entities",
      department: "engineering",
      assignedAgentId: "backend_dev",
      status: "queued",
      priority: "high",
      contextRefs: [{ type: "file", target: "docs/PLAN.md" }],
      expectedDeliverables: ["schema.sql"],
      delegationDepth: 0,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    it("creates, finds, updates, and deletes a task", async () => {
      // 1. Create
      const createRes = await db.tasks.create(sampleTask);
      expect(createRes.success).toBe(true);
      if (createRes.success) {
        expect(createRes.data.id).toBe("task_01");
        expect(createRes.data.title).toBe("Design storage schema");
      }

      // 2. Find by ID
      const findRes = await db.tasks.findById("task_01");
      expect(findRes.success).toBe(true);
      if (findRes.success) {
        expect(findRes.data).not.toBeNull();
        expect(findRes.data?.title).toBe("Design storage schema");
        expect(findRes.data?.contextRefs).toEqual([{ type: "file", target: "docs/PLAN.md" }]);
        expect(findRes.data?.expectedDeliverables).toEqual(["schema.sql"]);
        expect(findRes.data?.priority).toBe("high");
      }

      // 3. Update
      const updatedTask: Task = {
        ...sampleTask,
        status: "running",
        startedAt: "2026-11-07T00:05:00.000Z",
        updatedAt: "2026-11-07T00:05:00.000Z",
      };
      const updateRes = await db.tasks.update(updatedTask);
      expect(updateRes.success).toBe(true);

      const findUpdated = await db.tasks.findById("task_01");
      expect(findUpdated.success).toBe(true);
      if (findUpdated.success) {
        expect(findUpdated.data?.status).toBe("running");
        expect(findUpdated.data?.startedAt).toBe("2026-11-07T00:05:00.000Z");
      }

      // 4. List with filters
      const listRes = await db.tasks.list({ status: "running", department: "engineering" });
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        expect(listRes.data.length).toBe(1);
        expect(listRes.data[0]?.id).toBe("task_01");
      }

      const emptyList = await db.tasks.list({ status: "completed" });
      expect(emptyList.success).toBe(true);
      if (emptyList.success) {
        expect(emptyList.data.length).toBe(0);
      }

      // 5. Delete
      const delRes = await db.tasks.delete("task_01");
      expect(delRes.success).toBe(true);

      const findDeleted = await db.tasks.findById("task_01");
      expect(findDeleted.success).toBe(true);
      if (findDeleted.success) {
        expect(findDeleted.data).toBeNull();
      }
    });

    it("enforces unique constraint on task ID", async () => {
      await db.tasks.create(sampleTask);
      const duplicateRes = await db.tasks.create(sampleTask);
      expect(duplicateRes.success).toBe(false);
      if (!duplicateRes.success) {
        expect(duplicateRes.error instanceof DuplicateEntityError).toBe(true);
      }
    });

    it("enforces foreign key constraint on invalid parent_task_id", async () => {
      const childWithBadParent: Task = {
        ...sampleTask,
        id: "task_child",
        parentTaskId: "non_existent_parent",
      };
      const res = await db.tasks.create(childWithBadParent);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error instanceof ForeignKeyConstraintError).toBe(true);
      }
    });
  });

  describe("StepRepository", () => {
    const parentTask: Task = {
      id: "task_parent",
      title: "Parent task",
      description: "Description",
      department: "engineering",
      status: "running",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    const sampleStep: TaskStep = {
      id: "step_01",
      taskId: "task_parent",
      stepIndex: 0,
      title: "Execute initial migration",
      description: "Run migration runner",
      status: "pending",
      toolCalls: ["migration_runner"],
    };

    it("creates, finds, updates, lists, and deletes task steps", async () => {
      await db.tasks.create(parentTask);

      // Create step
      const stepRes = await db.steps.create(sampleStep);
      expect(stepRes.success).toBe(true);

      // Find by ID
      const findRes = await db.steps.findById("step_01");
      expect(findRes.success).toBe(true);
      if (findRes.success) {
        expect(findRes.data?.title).toBe("Execute initial migration");
        expect(findRes.data?.stepIndex).toBe(0);
      }

      // List by taskId
      const listRes = await db.steps.listByTaskId("task_parent");
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        expect(listRes.data.length).toBe(1);
        expect(listRes.data[0]?.id).toBe("step_01");
      }

      // Update step
      const updatedStep: TaskStep = {
        ...sampleStep,
        status: "completed",
        completedAt: "2026-11-07T00:01:00.000Z",
      };
      const updateRes = await db.steps.update(updatedStep);
      expect(updateRes.success).toBe(true);

      const findUpdated = await db.steps.findById("step_01");
      expect(findUpdated.success).toBe(true);
      if (findUpdated.success) {
        expect(findUpdated.data?.status).toBe("completed");
        expect(findUpdated.data?.completedAt).toBe("2026-11-07T00:01:00.000Z");
      }

      // Delete step
      const delRes = await db.steps.delete("step_01");
      expect(delRes.success).toBe(true);
    });

    it("fails with ForeignKeyConstraintError when referencing non-existent taskId", async () => {
      const orphanStep: TaskStep = {
        ...sampleStep,
        id: "step_orphan",
        taskId: "task_ghost",
      };
      const res = await db.steps.create(orphanStep);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error instanceof ForeignKeyConstraintError).toBe(true);
      }
    });
  });

  describe("ExecutionRepository", () => {
    const parentTask: Task = {
      id: "task_for_exec",
      title: "Task for execution",
      description: "Description",
      department: "engineering",
      status: "running",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    const sampleExec: Execution = {
      id: "exec_01",
      taskId: "task_for_exec",
      agentProfileId: "backend_dev",
      provider: "anthropic",
      model: "claude-3-7-sonnet",
      status: "running",
      metrics: {
        tokensPrompt: 100,
        tokensCompletion: 50,
        tokensTotal: 150,
        estimatedCostUsd: 0.0015,
        durationMs: 500,
      },
      startedAt: "2026-11-07T00:00:00.000Z",
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    it("persists execution, retrieves by ID and task ID, and updates metrics", async () => {
      await db.tasks.create(parentTask);

      const createRes = await db.executions.create(sampleExec);
      expect(createRes.success).toBe(true);

      const findRes = await db.executions.findById("exec_01");
      expect(findRes.success).toBe(true);
      if (findRes.success) {
        expect(findRes.data?.agentProfileId).toBe("backend_dev");
        expect(findRes.data?.metrics.tokensTotal).toBe(150);
        expect(findRes.data?.metrics.estimatedCostUsd).toBe(0.0015);
      }

      const listRes = await db.executions.listByTaskId("task_for_exec");
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        expect(listRes.data.length).toBe(1);
      }

      const updatedExec: Execution = {
        ...sampleExec,
        status: "completed",
        metrics: {
          ...sampleExec.metrics,
          tokensPrompt: 200,
          tokensCompletion: 100,
          tokensTotal: 300,
          estimatedCostUsd: 0.003,
        },
        finishedAt: "2026-11-07T00:01:00.000Z",
        updatedAt: "2026-11-07T00:01:00.000Z",
      };
      const updateRes = await db.executions.update(updatedExec);
      expect(updateRes.success).toBe(true);

      const findUpdated = await db.executions.findById("exec_01");
      expect(findUpdated.success).toBe(true);
      if (findUpdated.success) {
        expect(findUpdated.data?.status).toBe("completed");
        expect(findUpdated.data?.metrics.tokensTotal).toBe(300);
      }
    });

    it("fails with ForeignKeyConstraintError when referencing non-existent taskId", async () => {
      const orphanExec: Execution = {
        ...sampleExec,
        id: "exec_orphan",
        taskId: "task_ghost",
      };
      const res = await db.executions.create(orphanExec);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error instanceof ForeignKeyConstraintError).toBe(true);
      }
    });
  });

  describe("SessionRepository & Messages", () => {
    const sampleSession: Session = {
      id: "sess_01",
      title: "Architecture Discussion",
      mode: "interactive",
      status: "active",
      participantAgentIds: ["lead_architect"],
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    const sampleMessage: Message = {
      id: "msg_01",
      sessionId: "sess_01",
      senderId: "user_1",
      senderType: "user",
      role: "user",
      content: "Please implement SQLite persistence.",
      citations: [{ title: "PLAN.md", pathOrUri: "file://docs/PLAN.md" }],
      createdAt: "2026-11-07T00:00:01.000Z",
      updatedAt: "2026-11-07T00:00:01.000Z",
    };

    it("manages session lifecycle and message histories", async () => {
      // Create session
      const sessRes = await db.sessions.create(sampleSession);
      expect(sessRes.success).toBe(true);

      // Find session
      const findSess = await db.sessions.findById("sess_01");
      expect(findSess.success).toBe(true);
      if (findSess.success) {
        expect(findSess.data?.title).toBe("Architecture Discussion");
        expect(findSess.data?.status).toBe("active");
        expect(findSess.data?.mode).toBe("interactive");
      }

      // Add message
      const msgRes = await db.sessions.addMessage(sampleMessage);
      expect(msgRes.success).toBe(true);

      // List messages
      const listMsgs = await db.sessions.getMessages("sess_01");
      expect(listMsgs.success).toBe(true);
      if (listMsgs.success) {
        expect(listMsgs.data.length).toBe(1);
        expect(listMsgs.data[0]?.content).toBe("Please implement SQLite persistence.");
        expect(listMsgs.data[0]?.citations).toEqual([
          { title: "PLAN.md", pathOrUri: "file://docs/PLAN.md" },
        ]);
      }

      // Update session status
      const updatedSess: Session = {
        ...sampleSession,
        status: "paused",
        updatedAt: "2026-11-07T00:10:00.000Z",
      };
      const updateRes = await db.sessions.update(updatedSess);
      expect(updateRes.success).toBe(true);

      const findUpdated = await db.sessions.findById("sess_01");
      expect(findUpdated.success).toBe(true);
      if (findUpdated.success) {
        expect(findUpdated.data?.status).toBe("paused");
      }

      // List sessions
      const listSess = await db.sessions.list();
      expect(listSess.success).toBe(true);
      if (listSess.success) {
        expect(listSess.data.length).toBe(1);
      }
    });

    it("rejects message for non-existent session with ForeignKeyConstraintError", async () => {
      const ghostMsg: Message = {
        ...sampleMessage,
        id: "msg_ghost",
        sessionId: "non_existent_session",
      };
      const res = await db.sessions.addMessage(ghostMsg);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error instanceof ForeignKeyConstraintError).toBe(true);
      }
    });
  });

  describe("ArtifactRepository", () => {
    const parentTask: Task = {
      id: "task_artifact_owner",
      title: "Artifact creator task",
      description: "Description",
      department: "engineering",
      status: "running",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    const sampleArtifact: Artifact = {
      id: "art_01",
      taskId: "task_artifact_owner",
      agentId: "backend_dev",
      title: "schema.sql",
      artifactType: "code_patch",
      path: "packages/core/src/persistence/schema.sql",
      mimeType: "text/x-sql",
      checksum: "abc123def456",
      sizeBytes: 4096,
      isVerified: false,
      metadata: { generatedBy: "A1" },
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    it("creates, finds, updates, and lists artifacts", async () => {
      await db.tasks.create(parentTask);

      const createRes = await db.artifacts.create(sampleArtifact);
      expect(createRes.success).toBe(true);

      const findRes = await db.artifacts.findById("art_01");
      expect(findRes.success).toBe(true);
      if (findRes.success) {
        expect(findRes.data?.title).toBe("schema.sql");
        expect(findRes.data?.sizeBytes).toBe(4096);
        expect(findRes.data?.metadata).toEqual({ generatedBy: "A1" });
      }

      const listRes = await db.artifacts.listByTaskId("task_artifact_owner");
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        expect(listRes.data.length).toBe(1);
      }

      const updatedArt: Artifact = {
        ...sampleArtifact,
        isVerified: true,
        updatedAt: "2026-11-07T00:02:00.000Z",
      };
      const updateRes = await db.artifacts.update(updatedArt);
      expect(updateRes.success).toBe(true);

      const findUpdated = await db.artifacts.findById("art_01");
      expect(findUpdated.success).toBe(true);
      if (findUpdated.success) {
        expect(findUpdated.data?.isVerified).toBe(true);
      }
    });
  });

  describe("ApprovalRepository", () => {
    const parentTask: Task = {
      id: "task_for_approval",
      title: "Task requiring approval",
      description: "Description",
      department: "engineering",
      status: "running",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    const sampleApproval: ApprovalRequest = {
      id: "appr_01",
      taskId: "task_for_approval",
      requestedByAgentId: "backend_dev",
      actionType: "file_write",
      description: "Overwrite production configuration file",
      payload: { path: "config/prod.json" },
      status: "pending",
      requestedAt: "2026-11-07T00:00:00.000Z",
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    it("tracks approval requests and lifecycle decisions", async () => {
      await db.tasks.create(parentTask);

      const createRes = await db.approvals.create(sampleApproval);
      expect(createRes.success).toBe(true);

      const pending = await db.approvals.listPending();
      expect(pending.success).toBe(true);
      if (pending.success) {
        expect(pending.data.length).toBe(1);
        expect(pending.data[0]?.id).toBe("appr_01");
      }

      const decided: ApprovalRequest = {
        ...sampleApproval,
        status: "approved",
        reviewedByUserId: "user_lead",
        decisionReason: "Approved after team review",
        decidedAt: "2026-11-07T00:05:00.000Z",
        updatedAt: "2026-11-07T00:05:00.000Z",
      };
      const updateRes = await db.approvals.update(decided);
      expect(updateRes.success).toBe(true);

      const pendingAfter = await db.approvals.listPending();
      expect(pendingAfter.success).toBe(true);
      if (pendingAfter.success) {
        expect(pendingAfter.data.length).toBe(0);
      }

      const byTask = await db.approvals.listByTaskId("task_for_approval");
      expect(byTask.success).toBe(true);
      if (byTask.success) {
        expect(byTask.data.length).toBe(1);
        expect(byTask.data[0]?.status).toBe("approved");
        expect(byTask.data[0]?.reviewedByUserId).toBe("user_lead");
      }
    });
  });

  describe("EventRepository", () => {
    it("records and queries domain events with indexing filters", async () => {
      const event1: DomainEvent = {
        id: "evt_01",
        eventType: "task:created",
        source: "orchestrator",
        entityType: "Task",
        entityId: "task_01",
        payload: { title: "Task 1" },
        timestamp: "2026-11-07T00:00:00.000Z",
      };

      const event2: DomainEvent = {
        id: "evt_02",
        eventType: "task:completed",
        source: "orchestrator",
        entityType: "Task",
        entityId: "task_01",
        payload: { result: "All done" },
        timestamp: "2026-11-07T00:01:00.000Z",
      };

      const res1 = await db.events.record(event1);
      expect(res1.success).toBe(true);

      const res2 = await db.events.record(event2);
      expect(res2.success).toBe(true);

      const queryByEntity = await db.events.query({ entityId: "task_01" });
      expect(queryByEntity.success).toBe(true);
      if (queryByEntity.success) {
        expect(queryByEntity.data.length).toBe(2);
      }

      const queryByType = await db.events.query({ eventType: "task:completed" });
      expect(queryByType.success).toBe(true);
      if (queryByType.success) {
        expect(queryByType.data.length).toBe(1);
        expect(queryByType.data[0]?.id).toBe("evt_02");
      }
    });
  });

  describe("ReportRepository", () => {
    const parentTask: Task = {
      id: "task_report_owner",
      title: "Task generating report",
      description: "Description",
      department: "engineering",
      status: "completed",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    const sampleReport: Report = {
      id: "rep_01",
      taskId: "task_report_owner",
      title: "Persistence Implementation Report",
      reportType: "architecture_review",
      summary: "SQLite embedded persistence successfully implemented.",
      objective: "Verify SQLite embedded persistence implementation.",
      method: "Automated database integration test execution.",
      evidence: [],
      sources: [],
      assumptions: ["Database file is locally accessible"],
      confidence: "high",
      limitations: [],
      disagreements: [],
      recommendations: [],
      hasSimulatedData: false,
      findings: [
        {
          id: "find_01",
          title: "Fast in-memory testing",
          severity: "info",
          category: "performance",
          explanation: "Bun SQLite runs thousands of ops per second",
          recommendation: "Use for isolated test suites",
          confidence: "high",
          isSimulated: false,
        },
      ],
      markdownContent: "# Persistence Implementation Report\nAll tables implemented.",
      agentsInvolved: ["A1_architect"],
      status: "draft",
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    it("creates, finds, updates, and lists reports", async () => {
      await db.tasks.create(parentTask);

      const createRes = await db.reports.create(sampleReport);
      expect(createRes.success).toBe(true);

      const findRes = await db.reports.findById("rep_01");
      expect(findRes.success).toBe(true);
      if (findRes.success) {
        expect(findRes.data?.title).toBe("Persistence Implementation Report");
        expect(findRes.data?.findings.length).toBe(1);
        expect(findRes.data?.findings[0]?.severity).toBe("info");
      }

      const listRes = await db.reports.listByTaskId("task_report_owner");
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        expect(listRes.data.length).toBe(1);
      }
    });
  });

  describe("MemoryRepository", () => {
    const memoryItem: MemoryItem = {
      id: "mem_01",
      projectId: "default",
      category: "decision_rationale",
      key: "storage_engine",
      content: "Chose SQLite with WAL mode over Redis/Postgres per PLAN.md Section 10.1",
      confidence: "confirmed",
      tags: ["architecture", "storage", "sqlite"],
      isArchived: false,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    it("manages durable project memory and looks up by key", async () => {
      const createRes = await db.memory.create(memoryItem);
      expect(createRes.success).toBe(true);

      const findById = await db.memory.findById("mem_01");
      expect(findById.success).toBe(true);
      if (findById.success) {
        expect(findById.data?.key).toBe("storage_engine");
        expect(findById.data?.category).toBe("decision_rationale");
        expect(findById.data?.confidence).toBe("confirmed");
        expect(findById.data?.tags).toEqual(["architecture", "storage", "sqlite"]);
      }

      const findByKey = await db.memory.findByKey("decision_rationale", "storage_engine");
      expect(findByKey.success).toBe(true);
      if (findByKey.success) {
        expect(findByKey.data?.id).toBe("mem_01");
      }

      const listRes = await db.memory.list("decision_rationale");
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        expect(listRes.data.length).toBe(1);
      }

      // Update
      const updatedMem: MemoryItem = {
        ...memoryItem,
        content: "Updated decision record content",
        updatedAt: "2026-11-07T00:10:00.000Z",
      };
      const updateRes = await db.memory.update(updatedMem);
      expect(updateRes.success).toBe(true);

      const findUpdated = await db.memory.findById("mem_01");
      expect(findUpdated.success).toBe(true);
      if (findUpdated.success) {
        expect(findUpdated.data?.content).toBe("Updated decision record content");
      }

      // Delete
      const delRes = await db.memory.delete("mem_01");
      expect(delRes.success).toBe(true);

      const findDeleted = await db.memory.findById("mem_01");
      expect(findDeleted.success).toBe(true);
      if (findDeleted.success) {
        expect(findDeleted.data).toBeNull();
      }
    });

    it("enforces unique constraint on (category, key)", async () => {
      await db.memory.create(memoryItem);
      const duplicateKeyItem: MemoryItem = {
        ...memoryItem,
        id: "mem_02", // Different ID, but same (category, key)
      };
      const res = await db.memory.create(duplicateKeyItem);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error instanceof DuplicateEntityError).toBe(true);
      }
    });
  });

  describe("Transaction Atomicity (withTransaction)", () => {
    it("commits atomic operations across multiple repositories on success", async () => {
      const task: Task = {
        id: "tx_task_01",
        title: "Atomic Task",
        description: "Task created in transaction",
        department: "engineering",
        status: "queued",
        priority: "medium",
        contextRefs: [],
        expectedDeliverables: [],
        delegationDepth: 0,
        createdAt: "2026-11-07T00:00:00.000Z",
        updatedAt: "2026-11-07T00:00:00.000Z",
      };

      const step: TaskStep = {
        id: "tx_step_01",
        taskId: "tx_task_01",
        stepIndex: 0,
        title: "Step 1 in tx",
        description: "Step created in transaction",
        status: "pending",
      };

      const txResult = await db.withTransaction(async () => {
        const t = await db.tasks.create(task);
        if (!t.success) throw t.error;
        const s = await db.steps.create(step);
        if (!s.success) throw s.error;
        return { taskId: t.data.id, stepId: s.data.id };
      });

      expect(txResult.success).toBe(true);
      if (txResult.success) {
        expect(txResult.data.taskId).toBe("tx_task_01");
        expect(txResult.data.stepId).toBe("tx_step_01");
      }

      // Verify both entities are persisted
      const checkTask = await db.tasks.findById("tx_task_01");
      expect(checkTask.success).toBe(true);
      if (checkTask.success) {
        expect(checkTask.data).not.toBeNull();
      }

      const checkStep = await db.steps.findById("tx_step_01");
      expect(checkStep.success).toBe(true);
      if (checkStep.success) {
        expect(checkStep.data).not.toBeNull();
      }
    });

    it("rolls back all operations if any error is thrown during the transaction", async () => {
      const task: Task = {
        id: "tx_rollback_task",
        title: "Task should be rolled back",
        description: "Must not exist after tx failure",
        department: "engineering",
        status: "queued",
        priority: "medium",
        contextRefs: [],
        expectedDeliverables: [],
        delegationDepth: 0,
        createdAt: "2026-11-07T00:00:00.000Z",
        updatedAt: "2026-11-07T00:00:00.000Z",
      };

      const txResult = await db.withTransaction(async () => {
        const t = await db.tasks.create(task);
        if (!t.success) throw t.error;

        // Force an error intentionally
        throw new Error("Simulated mid-transaction failure");
      });

      expect(txResult.success).toBe(false);
      if (!txResult.success) {
        expect(txResult.error.message).toContain("Simulated mid-transaction failure");
      }

      // Verify task was NOT persisted due to rollback
      const checkTask = await db.tasks.findById("tx_rollback_task");
      expect(checkTask.success).toBe(true);
      if (checkTask.success) {
        expect(checkTask.data).toBeNull();
      }
    });
  });
});
