/**
 * @terrarium/core - intake/risk-detector.ts
 *
 * Deterministic risk evaluation and safety classification for user requests.
 * Aligns with PLAN.md Section 5.1 (Activation Policy), PLAN_CONTEXT.md Section 7
 * (Implementation Autonomy and Permissions), and Prompt 7 requirements.
 */

import { type RiskAssessment, type RiskLevel } from "@terrarium/contracts";
import { type NormalizedRequest } from "./request-normalizer.ts";

interface RiskRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly severity: "critical" | "high" | "medium";
  readonly factor: string;
  readonly operation: string;
  readonly mitigation: string;
}

const RISK_RULES: readonly RiskRule[] = [
  // Critical Risk Patterns
  {
    id: "drop_db",
    pattern: /\b(?:drop\s+(?:all\s+)?(?:tables?|databases?|schemas?)|delete\s+all\s+(?:records|data|tables?)|truncate\s+tables?|wipe\s+(?:all\s+)?(?:databases?|db|schemas?|tables?))\b/i,
    severity: "critical",
    factor: "Destructive database operation (dropping tables or wiping data)",
    operation: "database_destruction",
    mitigation: "Require explicit human-in-the-loop confirmation before applying database alterations",
  },
  {
    id: "recursive_rm",
    pattern: /\b(?:rm\s+-rf|del\s+\/s|rimraf|unlinkSync|delete\s+entire\s+repo|wipe\s+disk)\b/i,
    severity: "critical",
    factor: "Destructive bulk filesystem deletion command",
    operation: "filesystem_destruction",
    mitigation: "Enforce strict sandbox bounds; block arbitrary recursive file deletions",
  },
  {
    id: "bypass_auth",
    pattern: /\b(?:bypass\s+(?:auth|permission|check|rbac)|disable\s+security|remove\s+authentication|ignore\s+token)\b/i,
    severity: "critical",
    factor: "Request explicitly attempts to bypass authentication or security controls",
    operation: "security_bypass",
    mitigation: "Prohibit disabling security per system behavioral guidelines; require review by security specialist",
  },
  {
    id: "expose_secrets",
    pattern: /\b(?:print\s+api\s*key|expose\s+secret|leak\s+password|dump\s+env\s+vars|exfiltrate|send\s+token)\b/i,
    severity: "critical",
    factor: "Potential credential exfiltration or secret exposure",
    operation: "credential_exposure",
    mitigation: "Redact secrets automatically; never include credentials in transcripts, logs, or outputs",
  },
  {
    id: "prod_deploy",
    pattern: /\b(?:deploy\s+to\s+prod(?:uction)?|push\s+to\s+production|release\s+live|publish\s+to\s+npm)\b/i,
    severity: "critical",
    factor: "Production deployment or external package publication requested",
    operation: "production_deployment",
    mitigation: "Require explicit human approval before deploying or publishing artifacts externally",
  },

  // High Risk Patterns
  {
    id: "file_deletion",
    pattern: /\b(?:delete\s+(?:file|files|directory|folder)|remove\s+(?:file|files)|unlink)\b/i,
    severity: "high",
    factor: "File or directory deletion within the workspace",
    operation: "file_deletion",
    mitigation: "Require explicit confirmation and create git commit/backup before deleting files",
  },
  {
    id: "modify_credentials",
    pattern: /\b(?:\.env|\.secrets|api_key|password|jwt_secret|private_key)\b/i,
    severity: "high",
    factor: "Modifying or reading sensitive environment files or credentials",
    operation: "sensitive_configuration",
    mitigation: "Isolate secret handling to designated secret manager; prevent printing in outputs",
  },
  {
    id: "arbitrary_shell",
    pattern: /\b(?:exec|system|spawn|shell\s+command|run\s+bash|eval)\b/i,
    severity: "high",
    factor: "Arbitrary shell or command execution requested",
    operation: "shell_execution",
    mitigation: "Enforce command allowlist and isolate in non-privileged subprocess",
  },
  {
    id: "install_dependencies",
    pattern: /\b(?:npm\s+install|bun\s+add|yarn\s+add|pip\s+install|install\s+package)\b/i,
    severity: "high",
    factor: "Modifying dependency manifest or installing new third-party packages",
    operation: "dependency_modification",
    mitigation: "Prompt user for approval before adding or updating project dependencies",
  },

  // Medium Risk Patterns
  {
    id: "modify_code",
    pattern: /\b(?:implement|refactor|fix|modify|edit|update\s+code|add\s+function|write\s+code)\b/i,
    severity: "medium",
    factor: "Source code mutation in workspace",
    operation: "code_mutation",
    mitigation: "Perform edits in isolated git branch or working tree; run automated tests before finalization",
  },
  {
    id: "external_network",
    pattern: /\b(?:curl|fetch|http\s+request|external\s+api|download\s+from|web\s+scrape)\b/i,
    severity: "medium",
    factor: "Outbound network requests to external endpoints",
    operation: "network_access",
    mitigation: "Restrict network calls to declared provider endpoints and approved domains",
  },
];

/**
 * Evaluates operational, security, and data integrity risk for a request.
 */
export function evaluateRisk(
  normalized: NormalizedRequest,
  options: { autoApproveLowRisk?: boolean } = {}
): RiskAssessment {
  const text = normalized.normalizedPrompt;
  const factors: string[] = [];
  const mitigations: string[] = [];
  const sensitiveOperations: string[] = [];

  let highestSeverity: RiskLevel = "low";
  let totalScore = 5; // Baseline low risk for read-only inspection

  for (const rule of RISK_RULES) {
    if (rule.pattern.test(text)) {
      factors.push(rule.factor);
      mitigations.push(rule.mitigation);
      sensitiveOperations.push(rule.operation);

      if (rule.severity === "critical") {
        highestSeverity = "critical";
        totalScore = Math.max(totalScore, 90);
      } else if (rule.severity === "high") {
        if (highestSeverity !== "critical") {
          highestSeverity = "high";
        }
        totalScore = Math.max(totalScore, 65);
      } else if (rule.severity === "medium") {
        if (highestSeverity === "low") {
          highestSeverity = "medium";
        }
        totalScore = Math.max(totalScore, 35);
      }
    }
  }

  // De-duplicate mitigations
  const uniqueMitigations = Array.from(new Set(mitigations));
  const uniqueOperations = Array.from(new Set(sensitiveOperations));

  // Determine if approval is mandatory
  let requiresApproval = false;
  if (highestSeverity === "critical" || highestSeverity === "high") {
    requiresApproval = true;
  } else if (highestSeverity === "medium" && !options.autoApproveLowRisk) {
    requiresApproval = true;
  }

  if (highestSeverity === "low" && factors.length === 0) {
    factors.push("Read-only inspection and analysis; no destructive operations detected");
  }

  return {
    level: highestSeverity,
    score: Math.min(100, Math.max(0, totalScore)),
    factors,
    mitigations: uniqueMitigations,
    requiresApproval,
    sensitiveOperations: uniqueOperations,
  };
}
