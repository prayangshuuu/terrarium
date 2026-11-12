/**
 * @terrarium/core - reports/customer-simulator.ts
 *
 * Simulated customer research engine per PLAN.md Section 8 and Prompt 18.
 * Simulates how diverse persona profiles respond to product concepts, features, workflows, and pricing.
 * Strictly enforces simulation integrity:
 * - Never claims empirical user data, surveys, or statistical validity.
 * - Explains persona sampling and scenario constraints.
 * - Preserves objections, pricing friction, and meaningful persona disagreements.
 */

import {
  type CustomerSimulationPersona,
  type SimulatedCustomerFeedback,
  type CustomerSimulationMetadata,
  type ReportEvidenceItem,
  type ReportDisagreement,
  type ReportRecommendation,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";

export const CANONICAL_SIMULATION_PERSONAS: readonly CustomerSimulationPersona[] = [
  {
    id: "persona_enterprise_it",
    name: "Sarah Jenkins",
    archetype: "Enterprise IT Director & Buyer",
    demographicContext: "Tech enterprise with 500+ engineers, strict compliance mandates",
    background: "15 years overseeing developer tooling, SOC2 audits, and vendor security vetting.",
    primaryGoals: [
      "Ensure proprietary codebase never leaves company perimeter",
      "Centralized governance, audit logs, and cost predictability",
      "Seamless integration with existing enterprise CI/CD and IAM",
    ],
    constraints: [
      "Zero unvetted outbound telemetry or LLM data retention",
      "Must support least-privilege role-based human approvals",
      "Procurement timeline requires predictable enterprise licensing",
    ],
    knownBiases: [
      "Skeptical of all-in-one AI hype",
      "Prefers guardrails and safety over maximum autonomy",
      "Rejects tools lacking clear rollback and containment mechanisms",
    ],
  },
  {
    id: "persona_indie_dev",
    name: "Alex Rivera",
    archetype: "Solo Founder & Lead Engineer",
    demographicContext: "Bootstrapped micro-SaaS, agile solo operator",
    background: "Fullstack developer building fast, shipping daily, managing costs aggressively.",
    primaryGoals: [
      "Ship working code fast without context switching into web dashboards",
      "Keep operational tooling costs under $30/month",
      "Fast terminal keyboard ergonomics with zero friction",
    ],
    constraints: [
      "Cannot afford enterprise minimums or per-seat lock-in",
      "Refuses complex onboarding or mandatory cloud dependencies",
      "Needs reliable git patch workflows that do not mess up working tree",
    ],
    knownBiases: [
      "Allergic to enterprise sales calls and complex permission ceremonies",
      "Prefers local terminal CLIs over heavyweight GUIs",
      "Values transparency and direct file control",
    ],
  },
  {
    id: "persona_security_auditor",
    name: "Marcus Chen",
    archetype: "Principal Security Architect",
    demographicContext: "Fintech scaleup handling sensitive financial transaction code",
    background: "Offensive and defensive security researcher specializing in supply chain security.",
    primaryGoals: [
      "Prevent AI agents from reading secrets, credentials, or SSH keys",
      "Ensure all code modifications require explicit cryptographically verified approvals",
      "Maintain immutable provenance for every generated change",
    ],
    constraints: [
      "Hard isolation: read-only by default, sandboxed test execution",
      "Destructive command blocking (rm -rf, git reset --hard, unauthorized installs)",
      "Strict provenance trail linking every patch to its author agent and test proof",
    ],
    knownBiases: [
      "Treats all AI-generated code as untrusted input until proven otherwise",
      "Prioritizes containment over developer convenience",
    ],
  },
  {
    id: "persona_product_lead",
    name: "Priya Patel",
    archetype: "Staff Product Manager",
    demographicContext: "Mid-sized SaaS platform coordinating cross-functional squads",
    background: "Product strategist balancing customer requests, feature velocity, and technical debt.",
    primaryGoals: [
      "Rapidly synthesize customer problems into concrete architectural requirements",
      "Identify missing edge cases, pricing friction, and market risks early",
      "Export structured executive reports for engineering and executive leadership",
    ],
    constraints: [
      "Needs clear distinctions between sourced market facts and synthetic hypotheses",
      "Requires prioritized recommendations (P0/P1) with trade-off explanations",
      "Needs reports that can be previewed in terminal and shared in Git repo Markdown",
    ],
    knownBiases: [
      "Prefers actionable recommendations over raw technical logs",
      "Watches for customer churn risks and onboarding bottlenecks",
    ],
  },
];

export interface RunCustomerSimulationOptions {
  readonly concept: string;
  readonly scenario?: string;
  readonly targetPersonas?: readonly (string | CustomerSimulationPersona)[];
  readonly pricingHypothesis?: string;
}

export interface CustomerSimulationResult {
  readonly metadata: CustomerSimulationMetadata;
  readonly evidence: readonly ReportEvidenceItem[];
  readonly disagreements: readonly ReportDisagreement[];
  readonly recommendations: readonly ReportRecommendation[];
  readonly summary: string;
}

export class CustomerSimulator {
  /**
   * Executes synthetic persona simulation for a given product concept or scenario.
   */
  static runSimulation(options: RunCustomerSimulationOptions): CustomerSimulationResult {
    const concept = options.concept.trim();
    const scenario = options.scenario?.trim() || `Evaluation of product concept: "${concept}"`;
    const pricingHypothesis = options.pricingHypothesis || "Tiered: Open-source local core, usage-based model consumption";

    // Resolve personas
    const personas: CustomerSimulationPersona[] = [];
    if (options.targetPersonas && options.targetPersonas.length > 0) {
      for (const p of options.targetPersonas) {
        if (typeof p === "string") {
          const match = CANONICAL_SIMULATION_PERSONAS.find(
            (c) => c.id === p || c.archetype.toLowerCase().includes(p.toLowerCase())
          );
          if (match) personas.push(match);
        } else {
          personas.push(p);
        }
      }
    }
    if (personas.length === 0) {
      personas.push(...CANONICAL_SIMULATION_PERSONAS);
    }

    const feedbacks: SimulatedCustomerFeedback[] = [];
    const evidence: ReportEvidenceItem[] = [];

    let feedbackIndex = 1;
    for (const persona of personas) {
      const feedback = this.generatePersonaFeedback(persona, concept, scenario, pricingHypothesis, feedbackIndex++);
      feedbacks.push(feedback);

      // Convert feedback points into structured simulated evidence items
      evidence.push({
        id: `ev_sim_${feedback.id}_reaction`,
        claim: `[${persona.archetype} Reaction]: ${feedback.reaction}`,
        claimType: "simulated_feedback",
        confidence: "medium",
        isVerified: false,
        simulatedPersonaId: persona.id,
        rationale: `Simulated perspective based on persona background: ${persona.background}`,
        tags: ["simulation", persona.id, feedback.sentiment],
      });

      if (feedback.objections.length > 0) {
        evidence.push({
          id: `ev_sim_${feedback.id}_objection`,
          claim: `[${persona.archetype} Primary Objection]: ${feedback.objections[0]}`,
          claimType: "simulated_feedback",
          confidence: "medium",
          isVerified: false,
          simulatedPersonaId: persona.id,
          rationale: `Constraint driving objection: ${persona.constraints[0] ?? "Operational risk"}`,
          tags: ["simulation", "objection", persona.id],
        });
      }

      if (feedback.pricingSensitivityHypothesis) {
        evidence.push({
          id: `ev_sim_${feedback.id}_pricing`,
          claim: `[${persona.archetype} Pricing Sensitivity]: ${feedback.pricingSensitivityHypothesis}`,
          claimType: "hypothesis",
          confidence: "low",
          isVerified: false,
          simulatedPersonaId: persona.id,
          rationale: "Hypothetical willingness-to-pay derived from synthetic persona constraints.",
          tags: ["pricing", "hypothesis", persona.id],
        });
      }
    }

    // Identify meaningful disagreements between personas per PLAN.md Section 8.3 & 9
    const disagreements: ReportDisagreement[] = this.extractDisagreements(feedbacks, personas);

    // Formulate prioritized recommendations from feedback
    const recommendations: ReportRecommendation[] = this.formulateRecommendations(feedbacks);

    const samplingRationale = `Sampled ${personas.length} canonical archetypes (Enterprise IT, Indie Hacker, Security Architect, Product Lead) to assess enterprise governance, developer velocity, sandboxing safety, and product viability.`;

    const metadata: CustomerSimulationMetadata = {
      personas,
      scenario,
      assumptions: [
        "Personas evaluate the concept strictly against their specified goals and constraints",
        "Responses represent hypothetical synthetic exploration and require empirical user interview validation",
        "No statistical market conversion or general population adoption is inferred",
      ],
      samplingRationale,
      disclaimer: SIMULATED_RESEARCH_DISCLAIMER,
      simulatedFeedback: feedbacks,
    };

    const positiveCount = feedbacks.filter((f) => f.sentiment === "positive").length;
    const skepticalCount = feedbacks.filter((f) => f.sentiment === "skeptical" || f.sentiment === "negative").length;
    const summary = `Simulated customer research across ${personas.length} archetypes for "${concept}". Identified ${positiveCount} positive reactions, ${skepticalCount} friction/skeptical perspectives, and key tensions between enterprise governance and developer agility.`;

    return {
      metadata,
      evidence,
      disagreements,
      recommendations,
      summary,
    };
  }

  private static generatePersonaFeedback(
    persona: CustomerSimulationPersona,
    concept: string,
    scenario: string,
    pricingHypothesis: string,
    index: number
  ): SimulatedCustomerFeedback {
    const isEnterprise = persona.id.includes("enterprise") || persona.id.includes("security");
    const isIndie = persona.id.includes("indie");
    const isProduct = persona.id.includes("product");

    let sentiment: "positive" | "negative" | "mixed" | "skeptical" | "neutral" = "mixed";
    let reaction = "";
    const objections: string[] = [];
    const featureRequests: string[] = [];
    let pricingSensitivity = "";
    const adoptionBarriers: string[] = [];

    if (isEnterprise) {
      sentiment = "skeptical";
      reaction = `Cautiously interested in multi-agent orchestration, but strictly conditioned on least-privilege sandboxing, immutable audit logs, and human-in-the-loop approval gates.`;
      objections.push(
        "Risk of unintended code mutation or data leakage to third-party model providers",
        "Lack of centralized enterprise policy enforcement for agent tool access"
      );
      featureRequests.push(
        "Air-gapped local model provider support (Ollama / vLLM)",
        "Granular RBAC approval workflows before applying patches"
      );
      pricingSensitivity = "Willing to pay $100-$300/seat/month for enterprise security, compliance certifications, and SLA guarantees; zero willingness to pay for opaque usage models.";
      adoptionBarriers.push("Lengthy security review cycles", "Compliance mandates requiring data residency");
    } else if (isIndie) {
      sentiment = "positive";
      reaction = `Excited about terminal-first workflow and automated engineering tasks, provided it stays lightweight, fast, and does not require complex cloud setup.`;
      objections.push(
        "Heavyweight ceremony or excessive approval steps slows down rapid solo iteration",
        "Fear of unexpected token spend bills draining micro-budget"
      );
      featureRequests.push(
        "Quick keyboard shortcuts to bypass non-destructive approvals",
        "Strict hard spend limits with auto-kill when monthly budget is reached"
      );
      pricingSensitivity = "High price sensitivity. Prefers free open-source core with BYOK (bring your own API key); willing to pay $15-$25/month max for hosted convenience.";
      adoptionBarriers.push("Subscription fatigue", "Steep learning curve if TUI commands are unintuitive");
    } else if (isProduct) {
      sentiment = "positive";
      reaction = `Strongly validates the need for structured reporting, provenance tracking, and explicit disagreement preservation rather than bland consensus.`;
      objections.push(
        "Risk that generated reports become too verbose or full of low-value AI filler",
        "Need clean export formats (Markdown/JSON) to plug into existing squad retrospectives"
      );
      featureRequests.push(
        "Executive summary view with P0/P1 actionable recommendations",
        "Direct export to GitHub repository docs"
      );
      pricingSensitivity = "Values team alignment: comfortable with $40-$80/seat/month if it demonstrably shortens squad planning cycles.";
      adoptionBarriers.push("Squad adoption friction if reports are perceived as synthetic spam");
    } else {
      sentiment = "neutral";
      reaction = `Acknowledges utility for ${concept}, but requires empirical trial to gauge reliability vs manual coding.`;
      objections.push("Uncertainty regarding model accuracy on complex multi-file codebases");
      featureRequests.push("Bounded test runner with automatic rollback on test failure");
      pricingSensitivity = "Moderate sensitivity; desires clear free tier.";
      adoptionBarriers.push("Switching cost from current CLI tools");
    }

    return {
      id: `sim_fb_${persona.id}_${index}`,
      personaId: persona.id,
      personaName: persona.name,
      scenario,
      sentiment,
      reaction,
      objections,
      featureRequests,
      purchaseIntentHypothesis: sentiment === "positive" ? "Moderate to High" : "Low to Conditional",
      pricingSensitivityHypothesis: pricingSensitivity,
      adoptionBarriers,
    };
  }

  private static extractDisagreements(
    feedbacks: readonly SimulatedCustomerFeedback[],
    personas: readonly CustomerSimulationPersona[]
  ): ReportDisagreement[] {
    const disagreements: ReportDisagreement[] = [];

    // Disagreement 1: Approval Friction vs Autonomy
    const enterpriseFeedback = feedbacks.find((f) => f.personaId === "persona_enterprise_it" || f.personaId === "persona_security_auditor");
    const indieFeedback = feedbacks.find((f) => f.personaId === "persona_indie_dev");

    if (enterpriseFeedback && indieFeedback) {
      disagreements.push({
        id: "dis_governance_vs_velocity",
        topic: "Approval Gates: Strict Governance vs Frictionless Velocity",
        summary: "Enterprise buyers demand mandatory human approval gates for all file writes, whereas solo developers view excessive approval confirmation as friction.",
        resolutionStatus: "compromise",
        tradeOffImplication: "Configurable approval policies: enforce high-risk gating by default while allowing developer-configured trust levels for local dev environments.",
        perspectives: [
          {
            participantId: enterpriseFeedback.personaId,
            participantName: enterpriseFeedback.personaName,
            isSimulatedPersona: true,
            stance: "Mandatory human review for every file write and shell command.",
            rationale: "Unchecked AI agent execution poses unacceptable supply chain and data security risks.",
          },
          {
            participantId: indieFeedback.personaId,
            participantName: indieFeedback.personaName,
            isSimulatedPersona: true,
            stance: "Streamlined keyboard bypass for trusted local tasks.",
            rationale: "Halting on trivial read-only or low-risk modifications destroys flow state.",
          },
        ],
      });
    }

    // Disagreement 2: Pricing Structure
    const productFeedback = feedbacks.find((f) => f.personaId === "persona_product_lead");
    if (enterpriseFeedback && indieFeedback && productFeedback) {
      disagreements.push({
        id: "dis_pricing_model",
        topic: "Pricing Structure: Per-Seat Subscription vs BYOK Metering",
        summary: "Solo builders strongly demand BYOK (bring your own key) with minimal base cost, whereas enterprise buyers require per-seat annual predictability and consolidated invoices.",
        resolutionStatus: "acknowledged_tradeoff",
        tradeOffImplication: "Support hybrid monetization: free/BYOK tier for CLI developers, team/enterprise tier with governance, SSO, and pooled token budgets.",
        perspectives: [
          {
            participantId: indieFeedback.personaId,
            participantName: indieFeedback.personaName,
            isSimulatedPersona: true,
            stance: "Zero markup on model tokens; BYOK local execution.",
            rationale: "Cannot commit to recurring fixed subscriptions without guaranteed daily utilization.",
          },
          {
            participantId: enterpriseFeedback.personaId,
            participantName: enterpriseFeedback.personaName,
            isSimulatedPersona: true,
            stance: "Predictable annual invoice with enterprise support and security SLAs.",
            rationale: "Individual developer expense reports for API keys violate enterprise procurement rules.",
          },
        ],
      });
    }

    return disagreements;
  }

  private static formulateRecommendations(
    feedbacks: readonly SimulatedCustomerFeedback[]
  ): ReportRecommendation[] {
    return [
      {
        id: "rec_p0_sandbox_governance",
        priority: "P0",
        title: "Default to Least-Privilege Read-Only Sandbox with Explicit Approval Gates",
        description: "Enforce read-only file access by default, protect sensitive credential files, and require human approval before applying patches or running destructive shell tasks.",
        rationale: "Directly addresses critical adoption blockers raised by both Enterprise IT Buyer and Security Architect personas.",
        ownerRole: "Platform & Security Lead",
        nextActions: [
          "Validate shielded file patterns (.env, *.key, id_rsa)",
          "Implement atomic patch rollback on partial failures",
        ],
      },
      {
        id: "rec_p1_byok_and_budgets",
        priority: "P1",
        title: "Implement Strict Token Budgets and Bring-Your-Own-Key (BYOK) Routing",
        description: "Provide local developers with transparent budget limits, per-task spend gauges, and flexible provider routing across Anthropic, OpenAI, and Ollama.",
        rationale: "Mitigates pricing friction identified by Indie Developer persona while preserving cost control.",
        ownerRole: "Orchestration & Budget Lead",
        nextActions: [
          "Surface budget warning gauges in OpenTUI status bar",
          "Support offline local models via Ollama adapter",
        ],
      },
      {
        id: "rec_p2_markdown_export",
        priority: "P2",
        title: "Standardize Git-Friendly Markdown Report Generation and Workspace Export",
        description: "Enable single-keystroke or single-command export of structured reports directly into the project repository.",
        rationale: "Satisfies Product Lead requirement for squad collaboration and traceable decision memory.",
        ownerRole: "CLI & Product Interface Lead",
        nextActions: [
          "Add 'terrarium report export' CLI command",
          "Add [e] Export shortcut to OpenTUI Reports view",
        ],
      },
    ];
  }
}
