import { describe, expect, it } from "bun:test";
import {
  assertApprovalTransition,
  assertExecutionTransition,
  assertStepTransition,
  assertTaskTransition,
  isValidApprovalTransition,
  isValidExecutionTransition,
  isValidSessionTransition,
  isValidStepTransition,
  isValidTaskTransition,
  type ApprovalStatus,
  type ExecutionStatus,
  type SessionStatus,
  type StepStatus,
  type TaskStatus,
} from "../src/index.ts";

describe("Domain State Transitions & Lifecycle Machines", () => {
  describe("Task Lifecycle Transitions", () => {
    it("allows valid forward transitions", () => {
      expect(isValidTaskTransition("draft", "planned")).toBe(true);
      expect(isValidTaskTransition("planned", "queued")).toBe(true);
      expect(isValidTaskTransition("queued", "running")).toBe(true);
      expect(isValidTaskTransition("running", "waiting_for_input")).toBe(true);
      expect(isValidTaskTransition("waiting_for_input", "running")).toBe(true);
      expect(isValidTaskTransition("running", "waiting_for_approval")).toBe(true);
      expect(isValidTaskTransition("waiting_for_approval", "running")).toBe(true);
      expect(isValidTaskTransition("running", "completed")).toBe(true);
      expect(isValidTaskTransition("running", "failed")).toBe(true);
      expect(isValidTaskTransition("running", "blocked")).toBe(true);
      expect(isValidTaskTransition("blocked", "queued")).toBe(true);
    });

    it("allows cancellation from pre-terminal states", () => {
      expect(isValidTaskTransition("draft", "cancelled")).toBe(true);
      expect(isValidTaskTransition("planned", "cancelled")).toBe(true);
      expect(isValidTaskTransition("queued", "cancelled")).toBe(true);
      expect(isValidTaskTransition("running", "cancelled")).toBe(true);
      expect(isValidTaskTransition("waiting_for_input", "cancelled")).toBe(true);
      expect(isValidTaskTransition("waiting_for_approval", "cancelled")).toBe(true);
      expect(isValidTaskTransition("blocked", "cancelled")).toBe(true);
    });

    it("rejects invalid or illegal skipping transitions", () => {
      expect(isValidTaskTransition("draft", "running")).toBe(false);
      expect(isValidTaskTransition("draft", "completed")).toBe(false);
      expect(isValidTaskTransition("completed", "running")).toBe(false);
      expect(isValidTaskTransition("completed", "draft")).toBe(false);
      expect(isValidTaskTransition("cancelled", "running")).toBe(false);
    });

    it("supports bounded retry from failed to queued", () => {
      expect(isValidTaskTransition("failed", "queued")).toBe(true);
    });

    it("assertTaskTransition returns ok on valid transition and typed error on invalid transition", () => {
      const okRes = assertTaskTransition("queued", "running");
      expect(okRes.success).toBe(true);
      if (okRes.success) {
        expect(okRes.data).toBe("running");
      }

      const failRes = assertTaskTransition("draft", "completed");
      expect(failRes.success).toBe(false);
      if (!failRes.success) {
        expect(failRes.error.name).toBe("InvalidStateTransitionError");
        expect(failRes.error.entityType).toBe("Task");
        expect(failRes.error.fromState).toBe("draft");
        expect(failRes.error.toState).toBe("completed");
        expect(failRes.error.allowedTransitions).toEqual(["planned", "cancelled"]);
      }
    });

    it("treats identity transition as valid no-op", () => {
      expect(isValidTaskTransition("running", "running")).toBe(true);
    });
  });

  describe("TaskStep Lifecycle Transitions", () => {
    it("allows valid step progression", () => {
      expect(isValidStepTransition("pending", "running")).toBe(true);
      expect(isValidStepTransition("running", "completed")).toBe(true);
      expect(isValidStepTransition("pending", "skipped")).toBe(true);
      expect(isValidStepTransition("running", "failed")).toBe(true);
      expect(isValidStepTransition("failed", "pending")).toBe(true); // retry
    });

    it("rejects illegal step transitions", () => {
      expect(isValidStepTransition("pending", "completed")).toBe(false);
      expect(isValidStepTransition("completed", "running")).toBe(false);
      expect(isValidStepTransition("skipped", "running")).toBe(false);
    });

    it("assertStepTransition returns typed error on invalid transition", () => {
      const res = assertStepTransition("completed", "running");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.name).toBe("InvalidStateTransitionError");
        expect(res.error.entityType).toBe("TaskStep");
      }
    });
  });

  describe("Execution Lifecycle Transitions", () => {
    it("follows execution lifecycle", () => {
      expect(isValidExecutionTransition("idle", "queued")).toBe(true);
      expect(isValidExecutionTransition("queued", "running")).toBe(true);
      expect(isValidExecutionTransition("running", "completed")).toBe(true);
      expect(isValidExecutionTransition("running", "failed")).toBe(true);
      expect(isValidExecutionTransition("running", "blocked")).toBe(true);
      expect(isValidExecutionTransition("blocked", "running")).toBe(true);
    });

    it("rejects jumping to completed from idle", () => {
      expect(isValidExecutionTransition("idle", "completed")).toBe(false);
      const res = assertExecutionTransition("idle", "completed");
      expect(res.success).toBe(false);
    });
  });

  describe("Approval Request Lifecycle Transitions", () => {
    it("allows transition from pending to terminal decisions", () => {
      expect(isValidApprovalTransition("pending", "approved")).toBe(true);
      expect(isValidApprovalTransition("pending", "rejected")).toBe(true);
      expect(isValidApprovalTransition("pending", "expired")).toBe(true);
    });

    it("prevents mutating terminal approval states", () => {
      expect(isValidApprovalTransition("approved", "rejected")).toBe(false);
      expect(isValidApprovalTransition("rejected", "approved")).toBe(false);
      expect(isValidApprovalTransition("expired", "approved")).toBe(false);

      const res = assertApprovalTransition("approved", "pending");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.name).toBe("InvalidStateTransitionError");
      }
    });
  });

  describe("Session Lifecycle Transitions", () => {
    it("allows active, idle, paused, closed transitions", () => {
      expect(isValidSessionTransition("active", "idle")).toBe(true);
      expect(isValidSessionTransition("idle", "active")).toBe(true);
      expect(isValidSessionTransition("active", "paused")).toBe(true);
      expect(isValidSessionTransition("paused", "active")).toBe(true);
      expect(isValidSessionTransition("active", "closed")).toBe(true);
    });

    it("prevents transitions out of closed session", () => {
      expect(isValidSessionTransition("closed", "active")).toBe(false);
      expect(isValidSessionTransition("closed", "idle")).toBe(false);
    });
  });
});
