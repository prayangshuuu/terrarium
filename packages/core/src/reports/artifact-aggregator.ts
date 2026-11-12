/**
 * @terrarium/core - reports/artifact-aggregator.ts
 *
 * Aggregates deliverables, artifacts, test runs, code patches, and memory items
 * into a coherent structured Report while strictly preserving provenance.
 * Aligns with PLAN.md Section 15 and Prompt 18.
 */

import {
  type Artifact,
  type BoundedTestRunResult,
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type CustomerSimulationMetadata,
  type MemoryItem,
  type Report,
  type ReportDisagreement,
  type ReportEvidenceItem,
  type ReportFinding,
  type ReportRecommendation,
  type ReportSource,
  type ReportType,
  type Task,
  type TaskResult,
} from "@terrarium/contracts";
import { ReportSanitizer } from "./report-sanitizer.ts";

export interface AggregateArtifactsOptions {
  readonly taskId: string;
  readonly title: string;
  readonly reportType?: ReportType;
  readonly objective?: string;
  readonly summary?: string;
  readonly method?: string;
  readonly task?: Task;
  readonly taskResult?: TaskResult;
  readonly artifacts?: readonly Artifact[];
  readonly codePatches?: readonly CodeFilePatch[];
  readonly testRuns?: readonly BoundedTestRunResult[];
  readonly codeAnalysis?: CodeAnalysisSummary;
  readonly memoryItems?: readonly MemoryItem[];
  readonly findings?: readonly ReportFinding[];
  readonly simulationMetadata?: CustomerSimulationMetadata;
  readonly extraEvidence?: readonly ReportEvidenceItem[];
  readonly extraSources?: readonly ReportSource[];
  readonly extraDisagreements?: readonly ReportDisagreement[];
  readonly extraRecommendations?: readonly ReportRecommendation[];
  readonly assumptions?: readonly string[];
  readonly limitations?: readonly string[];
  readonly agentsInvolved?: readonly string[];
}

export class ArtifactAggregator {
  /**
   * Aggregates all provided task deliverables and artifacts into a unified structured Report.
   */
  static aggregate(options: AggregateArtifactsOptions): Omit<Report, "id" | "createdAt" | "updatedAt" | "markdownContent"> {
    const sources: ReportSource[] = [...(options.extraSources ?? [])];
    const evidence: ReportEvidenceItem[] = [...(options.extraEvidence ?? [])];
    const recommendations: ReportRecommendation[] = [...(options.extraRecommendations ?? [])];
    const disagreements: ReportDisagreement[] = [...(options.extraDisagreements ?? [])];
    const findings: ReportFinding[] = [...(options.findings ?? [])];
    const assumptions: string[] = [...(options.assumptions ?? [])];
    const limitations: string[] = [...(options.limitations ?? [])];
    const agentsInvolvedSet = new Set<string>(options.agentsInvolved ?? []);

    const now = new Date().toISOString();

    // 1. Process Task Deliverables & Artifacts
    if (options.artifacts) {
      for (const art of options.artifacts) {
        const sourceId = `src_art_${art.id}`;
        sources.push({
          id: sourceId,
          title: art.title,
          sourceType: "artifact",
          uri: art.path,
          checksum: art.checksum,
          retrievedAt: art.createdAt || now,
          notes: `Deliverable produced by agent ${art.agentId} for task ${art.taskId}`,
        });
        agentsInvolvedSet.add(art.agentId);

        evidence.push({
          id: `ev_art_${art.id}`,
          claim: `Deliverable "${art.title}" generated at ${art.path} (${art.sizeBytes} bytes, verified: ${art.isVerified})`,
          claimType: art.isVerified ? "verified_fact" : "generated_analysis",
          confidence: art.isVerified ? "high" : "medium",
          isVerified: art.isVerified,
          sourceId,
          sourceRef: art.path,
          rationale: `Artifact verified through domain validation checksum: ${art.checksum ?? "none"}`,
          tags: ["artifact", art.artifactType],
        });
      }
    }

    // 2. Process Code Static Analysis
    if (options.codeAnalysis) {
      const srcId = `src_analysis_${Date.now()}`;
      sources.push({
        id: srcId,
        title: "Engineering Studio Repository Static Scan",
        sourceType: "repository_file",
        uri: options.codeAnalysis.repoPath,
        retrievedAt: options.codeAnalysis.analyzedAt,
        notes: "Automated read-only repository static analysis",
      });

      const totalFiles = options.codeAnalysis.languages.reduce((acc, l) => acc + l.filesCount, 0);
      const langSummary = options.codeAnalysis.languages
        .map((l) => `${l.name}: ${l.percentage}% (${l.filesCount} files)`)
        .join(", ");

      evidence.push({
        id: `ev_repo_scan_${Date.now()}`,
        claim: `Repository scan confirmed ${totalFiles} files. Languages: ${langSummary || "unknown"}`,
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        sourceId: srcId,
        sourceRef: options.codeAnalysis.repoPath,
        rationale: "Direct file system scan within least-privilege boundary.",
        tags: ["repository_analysis", "static_scan"],
      });

      if (options.codeAnalysis.sensitiveFiles.length > 0) {
        evidence.push({
          id: `ev_shielded_files_${Date.now()}`,
          claim: `Shielded ${options.codeAnalysis.sensitiveFiles.length} sensitive credential files from unauthorized access.`,
          claimType: "verified_fact",
          confidence: "high",
          isVerified: true,
          sourceId: srcId,
          sourceRef: options.codeAnalysis.repoPath,
          rationale: "Least-privilege security shield regex matches.",
          tags: ["security", "shielded_files"],
        });
      }
    }

    // 3. Process Code File Patches
    if (options.codePatches) {
      for (const patch of options.codePatches) {
        const patchSrcId = `src_patch_${patch.id}`;
        sources.push({
          id: patchSrcId,
          title: `Code Patch: ${patch.filePath} (${patch.changeType})`,
          sourceType: "repository_file",
          uri: patch.filePath,
          checksum: patch.proposedHash,
          retrievedAt: patch.createdAt,
          notes: `Status: ${patch.status}, change type: ${patch.changeType}`,
        });

        evidence.push({
          id: `ev_patch_${patch.id}`,
          claim: `Proposed ${patch.changeType} patch on '${patch.filePath}' (${patch.hunks.length} diff hunks)`,
          claimType: "generated_analysis",
          confidence: "high",
          isVerified: patch.status === "applied",
          sourceId: patchSrcId,
          sourceRef: patch.filePath,
          rationale: ReportSanitizer.sanitize(patch.rationale).sanitizedText,
          tags: ["code_patch", patch.status],
        });

        if (patch.status === "applied") {
          recommendations.push({
            id: `rec_patch_verify_${patch.id}`,
            priority: "P1",
            title: `Run regression tests for applied patch on ${patch.filePath}`,
            description: `Verify that working tree changes on ${patch.filePath} execute cleanly in CI test suite.`,
            rationale: "Ensure post-application stability and verify rollback availability.",
            ownerRole: "Engineering Studio",
          });
        }
      }
    }

    // 4. Process Bounded Test Runs
    if (options.testRuns) {
      for (const testRun of options.testRuns) {
        const testSrcId = `src_test_${testRun.id}`;
        sources.push({
          id: testSrcId,
          title: `Test Execution: ${testRun.command}`,
          sourceType: "tool_output",
          retrievedAt: testRun.executedAt,
          notes: `Exit code: ${testRun.exitCode}, Duration: ${testRun.durationMs}ms`,
        });

        const isPassed = testRun.passed;
        evidence.push({
          id: `ev_test_${testRun.id}`,
          claim: `Test suite execution "${testRun.command}" ${isPassed ? "PASSED" : "FAILED"} (${testRun.passedTests}/${testRun.totalTests} passed, ${testRun.failedTests} failed in ${testRun.durationMs}ms)`,
          claimType: "verified_fact",
          confidence: "high",
          isVerified: true,
          sourceId: testSrcId,
          rationale: `Direct execution log verification. Exit code: ${testRun.exitCode}`,
          tags: ["test_execution", isPassed ? "pass" : "fail"],
        });

        if (!isPassed) {
          recommendations.push({
            id: `rec_test_fail_${testRun.id}`,
            priority: "P0",
            title: `Fix ${testRun.failedTests} failing tests in command "${testRun.command}"`,
            description: `Address test failures reported during bounded test execution before applying further code patches.`,
            rationale: "Zero-defect policy for applied patches.",
            ownerRole: "Senior Test & Reliability Engineer",
          });
        }
      }
    }

    // 5. Process Durable Memory Items
    if (options.memoryItems) {
      for (const mem of options.memoryItems) {
        const memSrcId = `src_mem_${mem.id}`;
        sources.push({
          id: memSrcId,
          title: `Project Memory: [${mem.category}] ${mem.key}`,
          sourceType: "memory",
          uri: mem.sourceReference,
          retrievedAt: mem.createdAt,
          notes: `Confidence: ${mem.confidence}`,
        });

        const isConfirmed = mem.confidence === "confirmed";
        evidence.push({
          id: `ev_mem_${mem.id}`,
          claim: `Persisted context [${mem.category}]: ${mem.content}`,
          claimType: isConfirmed ? "verified_fact" : mem.confidence === "hypothesis" ? "hypothesis" : "generated_analysis",
          confidence: isConfirmed ? "high" : mem.confidence === "hypothesis" ? "low" : "medium",
          isVerified: isConfirmed,
          sourceId: memSrcId,
          rationale: `Durable project memory item under category ${mem.category}.`,
          tags: ["memory", mem.category],
        });
      }
    }

    // 6. Process Simulation Metadata & Personas
    const hasSimulatedData = Boolean(
      options.simulationMetadata ||
      options.reportType === "customer_simulation" ||
      evidence.some((e) => e.claimType === "simulated_feedback")
    );

    if (options.simulationMetadata) {
      for (const persona of options.simulationMetadata.personas) {
        sources.push({
          id: `src_persona_${persona.id}`,
          title: `Simulated Customer Persona: ${persona.name} (${persona.archetype})`,
          sourceType: "simulated_persona",
          retrievedAt: now,
          isSimulatedPersona: true,
          notes: `Synthetic archetype. Demographic context: ${persona.demographicContext ?? "none"}`,
        });
      }

      for (const fb of options.simulationMetadata.simulatedFeedback) {
        // Ensure evidence contains persona feedback if not already present
        if (!evidence.some((e) => e.id.includes(fb.id))) {
          evidence.push({
            id: `ev_sim_${fb.id}`,
            claim: `[${fb.personaName}]: ${fb.reaction}`,
            claimType: "simulated_feedback",
            confidence: "medium",
            isVerified: false,
            sourceId: `src_persona_${fb.personaId}`,
            simulatedPersonaId: fb.personaId,
            rationale: `Synthetic feedback based on simulated scenario: ${fb.scenario}`,
            tags: ["simulation", fb.sentiment],
          });
        }
      }
    }

    // 7. Process Task Result Disagreements
    if (options.taskResult?.disagreements) {
      for (const d of options.taskResult.disagreements) {
        disagreements.push({
          id: `dis_tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          topic: d.topic,
          summary: d.synthesisNotes || `Debate regarding ${d.topic}`,
          resolutionStatus: d.resolutionStatus === "reconciled" ? "compromise" : "unresolved",
          perspectives: d.positions.map((p) => ({
            participantId: p.agentId,
            participantName: p.role,
            isSimulatedPersona: false,
            stance: p.stance,
            rationale: p.argument,
          })),
        });
      }
    }

    // Sanitize assumptions and limitations
    const sanitizedAssumptions = ReportSanitizer.sanitizeList(
      assumptions.length > 0 ? assumptions : ["Standard development workspace assumptions apply"]
    );

    const sanitizedLimitations = ReportSanitizer.sanitizeList(
      limitations.length > 0
        ? limitations
        : hasSimulatedData
        ? [
            "Customer feedback is synthetically simulated and must be empirically validated with real users.",
            "Model-generated findings reflect bounded static heuristics.",
          ]
        : ["Findings are bounded by available static analysis and test execution data."]
    );

    const reportType: ReportType = options.reportType ?? (hasSimulatedData ? "customer_simulation" : "architecture_review");
    const summary = ReportSanitizer.sanitize(
      options.summary ??
        (options.task
          ? `Execution report for task '${options.task.title}' across ${evidence.length} evidence items and ${sources.length} sources.`
          : `Synthesized report across ${evidence.length} evidence items.`)
    ).sanitizedText;

    const objective = ReportSanitizer.sanitize(
      options.objective ?? options.task?.description ?? "Comprehensive multi-agent deliverable assessment"
    ).sanitizedText;

    const method = ReportSanitizer.sanitize(
      options.method ??
        "Multi-agent artifact synthesis, static code verification, bounded test execution, and simulation modeling."
    ).sanitizedText;

    // Assess overall confidence based on evidence quality
    let confidence: "high" | "medium" | "low" = "high";
    const lowCount = evidence.filter((e) => e.confidence === "low").length;
    const verifiedCount = evidence.filter((e) => e.isVerified).length;
    if (lowCount > evidence.length / 2) {
      confidence = "low";
    } else if (verifiedCount < evidence.length / 3 && hasSimulatedData) {
      confidence = "medium";
    }

    return {
      taskId: options.taskId,
      title: ReportSanitizer.sanitize(options.title).sanitizedText,
      reportType,
      summary,
      objective,
      method,
      evidence,
      sources,
      assumptions: sanitizedAssumptions,
      confidence,
      confidenceRationale: `Assessed based on ${evidence.length} evidence items (${verifiedCount} verified facts, ${sources.length} sources).`,
      limitations: sanitizedLimitations,
      disagreements,
      recommendations,
      hasSimulatedData,
      simulationMetadata: options.simulationMetadata,
      findings,
      agentsInvolved: Array.from(agentsInvolvedSet),
      status: "final",
    };
  }
}
