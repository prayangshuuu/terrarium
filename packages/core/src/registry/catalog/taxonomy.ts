/**
 * @terrarium/core - registry/catalog/taxonomy.ts
 *
 * 50 Canonical Engineering & Organizational Domains for the 700+ Agent Ecosystem.
 * Aligns with Prompt 24 Section 8.2 and PLAN.md Section 4.
 * Contributed by A1 (Platform & Architecture) & A3 (Data, Security & Reliability).
 */

import { type AgentDepartment, type AgentDomain } from "@terrarium/contracts";

export interface DomainDefinition {
  readonly id: AgentDomain;
  readonly name: string;
  readonly department: AgentDepartment;
  readonly description: string;
  readonly primarySpecializations: readonly string[];
  readonly defaultPermissions: readonly string[];
  readonly riskLevel: "low" | "medium" | "high";
}

export const DOMAIN_DEFINITIONS: readonly DomainDefinition[] = [
  // 1. Platform Architecture
  {
    id: "platform_architecture",
    name: "Platform Architecture",
    department: "engineering",
    description: "Multi-service system architecture, modular decomposition, service meshes, and cross-boundary governance.",
    primarySpecializations: ["Service Mesh", "Modular Monoliths", "Event-Driven Architecture", "Multi-Tenancy", "Resilience Patterns"],
    defaultPermissions: ["read:project", "eval:architecture", "design:systems"],
    riskLevel: "medium",
  },
  // 2. Backend Engineering
  {
    id: "backend_engineering",
    name: "Backend Engineering",
    department: "engineering",
    description: "High-concurrency server runtimes, business logic engines, ORM tuning, and backend workflows.",
    primarySpecializations: ["Async Runtimes", "State Machines", "Transaction Engines", "Background Workers", "Microservices"],
    defaultPermissions: ["read:code", "modify:fs", "run:tests", "eval:backend"],
    riskLevel: "medium",
  },
  // 3. Frontend Engineering
  {
    id: "frontend_engineering",
    name: "Frontend Engineering",
    department: "engineering",
    description: "Modern web interfaces, component architecture, responsive layouts, hydration, and bundle optimization.",
    primarySpecializations: ["React Architecture", "State Management", "Micro-Frontends", "CSS Systems", "Client Performance"],
    defaultPermissions: ["read:code", "modify:fs", "eval:ui"],
    riskLevel: "low",
  },
  // 4. Fullstack Engineering
  {
    id: "fullstack_engineering",
    name: "Full-Stack Engineering",
    department: "engineering",
    description: "End-to-end feature delivery, server-side rendering, client-server contract synchronization, and full application lifecycle.",
    primarySpecializations: ["Next.js/Remix", "API Co-location", "Schema Sharing", "Auth Lifecycles", "Fullstack Testing"],
    defaultPermissions: ["read:code", "modify:fs", "run:tests", "eval:fullstack"],
    riskLevel: "medium",
  },
  // 5. CLI & TUI Engineering
  {
    id: "cli_tui_engineering",
    name: "CLI & TUI Engineering",
    department: "engineering",
    description: "Terminal user interfaces, argument parsing, ANSI styling, subcommands, and headless terminal utilities.",
    primarySpecializations: ["OpenTUI Components", "POSIX Argument Parsing", "Terminal Geometry", "Stream Rendering", "Interactive Shells"],
    defaultPermissions: ["read:code", "modify:fs", "eval:cli"],
    riskLevel: "low",
  },
  // 6. Mobile Engineering
  {
    id: "mobile_engineering",
    name: "Mobile Engineering",
    department: "engineering",
    description: "Native and cross-platform mobile runtimes, offline synchronization, mobile security, and platform bridges.",
    primarySpecializations: ["React Native", "iOS/Swift Architecture", "Android/Kotlin Performance", "Offline Sync", "App Lifecycle"],
    defaultPermissions: ["read:code", "eval:mobile"],
    riskLevel: "low",
  },
  // 7. API Design
  {
    id: "api_design",
    name: "API Design & Protocols",
    department: "engineering",
    description: "RESTful, GraphQL, gRPC, and RPC interface design, API governance, versioning, and developer ergonomics.",
    primarySpecializations: ["OpenAPI/Swagger", "gRPC Protobuf", "GraphQL Federation", "Contract Testing", "Rate Limiting Policy"],
    defaultPermissions: ["read:contracts", "design:api", "eval:protocols"],
    riskLevel: "low",
  },
  // 8. Distributed Systems
  {
    id: "distributed_systems",
    name: "Distributed Systems",
    department: "engineering",
    description: "Distributed consensus, quorum protocols, partition tolerance, distributed caching, and vector clocks.",
    primarySpecializations: ["Raft Consensus", "Distributed Locking", "CRDTs", "Sharding Topologies", "Idempotency"],
    defaultPermissions: ["read:architecture", "eval:distributed", "design:scale"],
    riskLevel: "high",
  },
  // 9. Database Engineering
  {
    id: "database_engineering",
    name: "Database Engineering",
    department: "engineering",
    description: "Relational, document, and key-value database schemas, query planner optimization, and indexing strategies.",
    primarySpecializations: ["PostgreSQL Optimization", "SQLite Runtimes", "Index Strategy", "Migration Safety", "Connection Pooling"],
    defaultPermissions: ["read:db_schema", "eval:sql", "optimize:queries"],
    riskLevel: "medium",
  },
  // 10. Data Engineering
  {
    id: "data_engineering",
    name: "Data Engineering",
    department: "engineering",
    description: "Batch and stream data pipelines, lakehouse architectures, ETL/ELT orchestration, and schema evolution.",
    primarySpecializations: ["Stream Ingestion", "Delta Lake / Iceberg", "dbt Modeling", "Pipeline Idempotency", "Data Quality"],
    defaultPermissions: ["read:data_pipelines", "eval:etl", "design:lakehouse"],
    riskLevel: "medium",
  },
  // 11. Data Science
  {
    id: "data_science",
    name: "Data Science & Statistical Analysis",
    department: "research",
    description: "Exploratory data analysis, statistical hypothesis testing, cohort analysis, and predictive modeling.",
    primarySpecializations: ["A/B Testing", "Cohort Modeling", "Time-Series Forecasting", "Statistical Inference", "Feature Engineering"],
    defaultPermissions: ["read:data", "eval:statistics", "analyze:metrics"],
    riskLevel: "low",
  },
  // 12. Machine Learning
  {
    id: "machine_learning",
    name: "Machine Learning",
    department: "research",
    description: "Classical and ensemble ML algorithms, gradient boosting, classification, regression, and model validation.",
    primarySpecializations: ["XGBoost/LightGBM", "Cross-Validation", "Hyperparameter Tuning", "Anomaly Detection", "Model Explainability"],
    defaultPermissions: ["read:models", "eval:ml", "design:pipelines"],
    riskLevel: "low",
  },
  // 13. Deep Learning
  {
    id: "deep_learning",
    name: "Deep Learning & Neural Architectures",
    department: "research",
    description: "Neural network architectures, transformer models, backpropagation optimization, and tensor computations.",
    primarySpecializations: ["Transformer Models", "Diffusion Runtimes", "PyTorch Optimization", "Quantization", "Tensor Parallelism"],
    defaultPermissions: ["read:tensors", "eval:neural_net", "design:deep_learning"],
    riskLevel: "medium",
  },
  // 14. LLM Engineering
  {
    id: "llm_engineering",
    name: "LLM Engineering & Prompt Design",
    department: "research",
    description: "Frontier model prompting, structured output enforcement, parameter tuning, context window optimization, and prompt evaluation.",
    primarySpecializations: ["Prompt Evaluation", "Structured JSON Extraction", "Context Window Management", "Fine-Tuning LoRA", "Model Routing"],
    defaultPermissions: ["read:prompts", "eval:llm", "optimize:context"],
    riskLevel: "low",
  },
  // 15. RAG and Knowledge Systems
  {
    id: "rag_knowledge_systems",
    name: "RAG & Knowledge Systems",
    department: "research",
    description: "Retrieval-augmented generation, vector embedding databases, hybrid sparse/dense search, and semantic chunking.",
    primarySpecializations: ["Semantic Chunking", "Hybrid Vector Search", "Cross-Encoder Re-Ranking", "Graph RAG", "Knowledge Graphs"],
    defaultPermissions: ["read:embeddings", "eval:retrieval", "design:rag"],
    riskLevel: "low",
  },
  // 16. Agentic Systems
  {
    id: "agentic_systems",
    name: "Agentic Systems & Multi-Agent Runtimes",
    department: "research",
    description: "Multi-agent coordination protocols, demand-based activation, reflection loops, planning trees, and tool use.",
    primarySpecializations: ["Demand-Based Activation", "Tool Routing", "Plan & Solve Cycles", "Consensus Synthesis", "Agent Protocol (ACP/MCP)"],
    defaultPermissions: ["read:agents", "eval:coordination", "design:agent_loops"],
    riskLevel: "medium",
  },
  // 17. MLOps
  {
    id: "mlops",
    name: "MLOps & Model Governance",
    department: "engineering",
    description: "Model registry management, inference serving, feature stores, drift detection, and ML CI/CD pipelines.",
    primarySpecializations: ["Model Registries", "Inference Latency", "Data Drift Detection", "Feature Stores", "Shadow Deployments"],
    defaultPermissions: ["read:mlops", "eval:model_serving", "monitor:drift"],
    riskLevel: "medium",
  },
  // 18. DevOps
  {
    id: "devops",
    name: "DevOps & Infrastructure Automation",
    department: "engineering",
    description: "Continuous integration, declarative deployment pipelines, infrastructure as code, and build caching.",
    primarySpecializations: ["GitHub Actions", "Terraform / OpenTofu", "Container Orchestration", "Artifact Caching", "GitOps (ArgoCD)"],
    defaultPermissions: ["read:ci_cd", "eval:pipelines", "design:automation"],
    riskLevel: "medium",
  },
  // 19. SRE & Reliability
  {
    id: "sre_reliability",
    name: "Site Reliability Engineering (SRE)",
    department: "engineering",
    description: "Service level indicators (SLIs), service level objectives (SLOs), error budgets, incident postmortems, and chaos engineering.",
    primarySpecializations: ["SLO / Error Budgets", "Incident Response Runbooks", "Chaos Engineering", "Circuit Breaking", "Capacity Planning"],
    defaultPermissions: ["read:metrics", "eval:reliability", "audit:sre"],
    riskLevel: "medium",
  },
  // 20. Cloud Infrastructure
  {
    id: "cloud_infrastructure",
    name: "Cloud Infrastructure & Networking",
    department: "engineering",
    description: "Multi-cloud architecture, VPC topologies, Kubernetes cluster administration, and cloud security boundaries.",
    primarySpecializations: ["Kubernetes (EKS/GKE)", "VPC Peering & Transit", "IAM Principle of Least Privilege", "Terraform Modules", "Cost Allocation"],
    defaultPermissions: ["read:cloud_config", "eval:infrastructure", "design:cloud"],
    riskLevel: "high",
  },
  // 21. Networking
  {
    id: "networking",
    name: "Networking & Transport Protocols",
    department: "engineering",
    description: "TCP/IP, UDP, QUIC, TLS 1.3 handshakes, DNS resolution, BGP routing, and HTTP/3 performance.",
    primarySpecializations: ["TLS / mTLS", "QUIC & HTTP/3", "DNS Architecture", "Load Balancing Algorithms", "Packet Analysis"],
    defaultPermissions: ["read:network", "eval:protocols", "audit:transport"],
    riskLevel: "medium",
  },
  // 22. Cybersecurity & Defensive Security
  {
    id: "cybersecurity_defense",
    name: "Cybersecurity & Defensive Security",
    department: "security",
    description: "Threat modeling, zero-trust network access, defense in depth, vulnerability scanning, and security hardening.",
    primarySpecializations: ["Zero Trust", "Threat Modeling (STRIDE)", "Hardening Standards (CIS)", "SIEM & SOC Rules", "Vulnerability Management"],
    defaultPermissions: ["audit:security", "eval:threats", "read:policies"],
    riskLevel: "high",
  },
  // 23. Application Security
  {
    id: "application_security",
    name: "Application Security (AppSec)",
    department: "security",
    description: "SAST/DAST analysis, OWASP Top 10 mitigation, secure coding reviews, cryptography implementation, and supply chain security.",
    primarySpecializations: ["OWASP Top 10", "Dependency Auditing (SBOM)", "Secret Scanning", "Authentication Security", "Cryptographic Review"],
    defaultPermissions: ["read:code", "audit:appsec", "eval:vulnerabilities"],
    riskLevel: "high",
  },
  // 24. Privacy Engineering
  {
    id: "privacy_engineering",
    name: "Privacy Engineering & Data Protection",
    department: "security",
    description: "PII masking, differential privacy, GDPR/CCPA technical controls, data retention lifecycles, and cryptographic anonymization.",
    primarySpecializations: ["PII Redaction", "Differential Privacy", "Retention Policies", "Data Subject Access Requests", "Consent Tracking"],
    defaultPermissions: ["audit:privacy", "eval:compliance", "read:data_policies"],
    riskLevel: "medium",
  },
  // 25. Testing & QA
  {
    id: "testing_qa",
    name: "Quality Assurance & Test Automation",
    department: "engineering",
    description: "Unit, integration, end-to-end, mutation, and regression test suites, mock strategies, and coverage gates.",
    primarySpecializations: ["E2E Automation (Playwright)", "Mutation Testing", "Mock & Stub Strategies", "Contract Testing", "Flaky Test Elimination"],
    defaultPermissions: ["read:tests", "run:tests", "eval:coverage"],
    riskLevel: "low",
  },
  // 26. Performance Engineering
  {
    id: "performance_engineering",
    name: "Performance & Benchmark Engineering",
    department: "engineering",
    description: "Profiling, CPU/memory flamegraphs, latency percentiles (p95/p99), load testing, and bottleneck remediation.",
    primarySpecializations: ["Flamegraph Profiling", "Load Testing (k6)", "Memory Leak Detection", "p99 Tail Latency", "V8 Engine Tuning"],
    defaultPermissions: ["read:benchmarks", "eval:performance", "profile:runtime"],
    riskLevel: "low",
  },
  // 27. Accessibility
  {
    id: "accessibility",
    name: "Accessibility (a11y) & Inclusive Design",
    department: "design",
    description: "WCAG 2.2 AA/AAA compliance, screen reader tree evaluation, keyboard navigation traps, and ARIA attributes.",
    primarySpecializations: ["WCAG 2.2 Compliance", "Screen Reader Navigation", "ARIA Landmark Audit", "Keyboard Focus Loops", "Color Contrast Ratios"],
    defaultPermissions: ["read:ui", "audit:a11y", "eval:wcag"],
    riskLevel: "low",
  },
  // 28. UX Research
  {
    id: "ux_research",
    name: "UX Research & Usability Engineering",
    department: "design",
    description: "Usability evaluations, user interview synthesis, cognitive walkthroughs, task completion analysis, and heuristic audits.",
    primarySpecializations: ["Heuristic Evaluation", "Cognitive Walkthrough", "Usability Testing", "Journey Mapping", "Information Architecture"],
    defaultPermissions: ["read:designs", "eval:usability", "synthesize:research"],
    riskLevel: "low",
  },
  // 29. Product Design
  {
    id: "product_design",
    name: "Product Design & Design Systems",
    department: "design",
    description: "Design tokens, interaction design, typographic hierarchies, responsive components, and UI visual consistency.",
    primarySpecializations: ["Design System Tokens", "Interaction States", "Visual Hierarchy", "Information Density", "Error State UX"],
    defaultPermissions: ["read:designs", "eval:design_system", "design:ui"],
    riskLevel: "low",
  },
  // 30. Product Management
  {
    id: "product_management",
    name: "Product Management & Roadmapping",
    department: "product",
    description: "Product requirement documents (PRD), feature prioritization, trade-off matrix analysis, and value hypothesis validation.",
    primarySpecializations: ["PRD Authoring", "Feature Prioritization (RICE)", "User Story Mapping", "Value Proposition Audit", "MVP Scoping"],
    defaultPermissions: ["read:project", "eval:product", "synthesize:priorities"],
    riskLevel: "low",
  },
  // 31. Technical Writing
  {
    id: "technical_writing",
    name: "Technical Writing & Developer Documentation",
    department: "documentation",
    description: "API references, architecture deep-dives, developer guides, READMEs, and quickstart tutorials.",
    primarySpecializations: ["API Reference Authoring", "Architecture Guides", "Runbook Documentation", "Tutorial Design", "Docs-as-Code"],
    defaultPermissions: ["read:project", "modify:docs", "eval:documentation"],
    riskLevel: "low",
  },
  // 32. Documentation Engineering
  {
    id: "documentation",
    name: "Documentation Engineering & Systems",
    department: "documentation",
    description: "Static documentation generators (Starlight, Docusaurus), doc search indexing, code snippet verification, and linting.",
    primarySpecializations: ["Snippet Automated Testing", "Vale Prose Linting", "Algolia Search Config", "Doc Versioning", "Diagramming as Code"],
    defaultPermissions: ["read:docs", "eval:doc_infrastructure", "run:doc_tests"],
    riskLevel: "low",
  },
  // 33. Research Methodology
  {
    id: "research_methodology",
    name: "Research Methodology & Evaluation",
    department: "research",
    description: "Structured evaluation frameworks, benchmarking rigor, falsification criteria, and evidence citation standards.",
    primarySpecializations: ["Benchmarking Rigor", "Falsification Frameworks", "Evidence Tracing", "Meta-Analysis", "Methodology Audit"],
    defaultPermissions: ["read:reports", "eval:methodology", "audit:evidence"],
    riskLevel: "low",
  },
  // 34. Scientific Computing
  {
    id: "scientific_computing",
    name: "Scientific Computing & Numerical Analysis",
    department: "research",
    description: "Floating-point precision, linear algebra, numerical stability, differential equations, and scientific simulations.",
    primarySpecializations: ["NumPy/SciPy Stability", "Matrix Decompositions", "Monte Carlo Methods", "Error Propagation", "GPU Numerical Acceleration"],
    defaultPermissions: ["read:code", "eval:numerical", "run:simulations"],
    riskLevel: "low",
  },
  // 35. Embedded Systems
  {
    id: "embedded_systems",
    name: "Embedded Systems & Firmware",
    department: "engineering",
    description: "Bare-metal runtimes, RTOS scheduling, microcontroller registers, memory-mapped I/O, and low-power states.",
    primarySpecializations: ["FreeRTOS", "Memory-Mapped I/O", "Interrupt Handling", "Power Management", "Hardware Abstraction Layers (HAL)"],
    defaultPermissions: ["read:code", "eval:embedded", "audit:firmware"],
    riskLevel: "medium",
  },
  // 36. IoT
  {
    id: "iot",
    name: "Internet of Things (IoT) & Telemetry",
    department: "engineering",
    description: "MQTT/CoAP protocols, constrained device telemetry, edge gateway aggregation, and device shadow synchronization.",
    primarySpecializations: ["MQTT/CoAP", "Device Provisioning", "OTA Firmware Updates", "Sensor Telemetry", "Edge Gateway Architecture"],
    defaultPermissions: ["read:iot_config", "eval:iot", "design:telemetry"],
    riskLevel: "medium",
  },
  // 37. Robotics
  {
    id: "robotics",
    name: "Robotics & Autonomous Systems",
    department: "engineering",
    description: "ROS/ROS2 nodes, kinematics, state estimation, path planning, and sensor fusion (LiDAR, IMU).",
    primarySpecializations: ["ROS2 Node Graphs", "Kinematics & Dynamics", "Kalman Filtering", "Path Planning (A*/RRT)", "Sensor Fusion"],
    defaultPermissions: ["read:code", "eval:robotics", "audit:control_loops"],
    riskLevel: "medium",
  },
  // 38. Edge Computing
  {
    id: "edge_computing",
    name: "Edge Computing & CDN Workers",
    department: "engineering",
    description: "Wasm edge execution, Cloudflare Workers, edge key-value storage, and geographic request colocation.",
    primarySpecializations: ["Wasm Edge Runtimes", "Cloudflare Workers / Deno", "Geo-Distributed State", "Edge Cache Invalidation", "Cold Start Optimization"],
    defaultPermissions: ["read:code", "eval:edge", "design:edge"],
    riskLevel: "low",
  },
  // 39. Computer Vision
  {
    id: "computer_vision",
    name: "Computer Vision & Image Processing",
    department: "research",
    description: "Object detection, semantic segmentation, image augmentation, OpenCV pipelines, and optical character recognition.",
    primarySpecializations: ["YOLO / Object Detection", "Semantic Segmentation", "OpenCV Pipelines", "Video Stream Processing", "ONNX Model Export"],
    defaultPermissions: ["read:cv_models", "eval:vision", "process:images"],
    riskLevel: "low",
  },
  // 40. Signal Processing
  {
    id: "signal_processing",
    name: "Signal Processing & DSP",
    department: "research",
    description: "Fourier transforms (FFT), digital filtering (FIR/IIR), wavelet analysis, noise reduction, and sampling theory.",
    primarySpecializations: ["FFT Analysis", "FIR/IIR Filter Design", "Spectral Analysis", "Noise Cancellation", "Nyquist Sampling Compliance"],
    defaultPermissions: ["read:signals", "eval:dsp", "analyze:frequencies"],
    riskLevel: "low",
  },
  // 41. Audio & Speech Systems
  {
    id: "audio_speech_systems",
    name: "Audio & Speech Systems",
    department: "research",
    description: "Automated speech recognition (Whisper), text-to-speech synthesis, acoustic modeling, and audio codecs.",
    primarySpecializations: ["Whisper Speech Recognition", "Neural TTS Synthesis", "Acoustic Feature Extraction", "Audio Codecs (Opus/AAC)", "Voice Activity Detection"],
    defaultPermissions: ["read:audio", "eval:speech", "process:audio"],
    riskLevel: "low",
  },
  // 42. Language Technology
  {
    id: "language_technology",
    name: "Language Technology & Computational Linguistics",
    department: "research",
    description: "Tokenization, morpho-syntactic parsing, multilingual embeddings, named entity recognition (NER), and grammar formalisms.",
    primarySpecializations: ["BPE/WordPiece Tokenization", "Named Entity Recognition", "Dependency Parsing", "Multilingual Embeddings", "Morphological Analysis"],
    defaultPermissions: ["read:nlp", "eval:language", "analyze:syntax"],
    riskLevel: "low",
  },
  // 43. Localization
  {
    id: "localization",
    name: "Localization (l10n) & Internationalization (i18n)",
    department: "customer_intelligence",
    description: "ICU message formats, pluralization rules, bidirectional text (RTL/LTR), pseudo-localization, and translation workflows.",
    primarySpecializations: ["ICU MessageFormat", "RTL UI Layouts", "Pseudo-Localization Testing", "Translation Memory (TMX)", "Locale Formatting (Dates/Currencies)"],
    defaultPermissions: ["read:i18n", "eval:localization", "audit:translations"],
    riskLevel: "low",
  },
  // 44. FinOps & Cost Optimization
  {
    id: "finops_cost_optimization",
    name: "FinOps & Cloud Cost Optimization",
    department: "executive",
    description: "Cloud spend allocation, reserved instance planning, egress traffic cost reduction, and cost-per-query attribution.",
    primarySpecializations: ["Cloud Bill Attribution", "Reserved / Spot Strategy", "Egress Cost Reduction", "Token Spend Tracking", "Waste Elimination"],
    defaultPermissions: ["read:costs", "eval:finops", "optimize:budget"],
    riskLevel: "low",
  },
  // 45. Compliance Support
  {
    id: "compliance_support",
    name: "Compliance Support & Regulatory Auditing",
    department: "legal",
    description: "SOC 2 Type II controls, ISO 27001 evidence gathering, HIPAA security safeguards, and immutable audit logs.",
    primarySpecializations: ["SOC 2 Compliance", "Immutable Audit Logging", "Access Control Recertification", "HIPAA Safeguards", "Vendor Risk Assessment"],
    defaultPermissions: ["audit:compliance", "read:audit_logs", "eval:regulations"],
    riskLevel: "high",
  },
  // 46. Release Engineering
  {
    id: "release_engineering",
    name: "Release Engineering & Distribution",
    department: "engineering",
    description: "Semantic versioning, release train coordination, artifact signing (cosign), changelog generation, and rollbacks.",
    primarySpecializations: ["Semantic Versioning", "Reproducible Builds", "Cosign Artifact Signing", "Canary Deployment Gates", "Automated Rollbacks"],
    defaultPermissions: ["read:releases", "eval:distribution", "design:release_train"],
    riskLevel: "medium",
  },
  // 47. Incident Response
  {
    id: "incident_response",
    name: "Incident Response & Forensics",
    department: "security",
    description: "Security incident triage, forensic log acquisition, root cause attribution, containment runbooks, and retrospective reporting.",
    primarySpecializations: ["Incident Triage", "Log Forensics", "Containment Runbooks", "Blameless Postmortems", "Timeline Reconstruction"],
    defaultPermissions: ["audit:incidents", "read:telemetry", "eval:forensics"],
    riskLevel: "high",
  },
  // 48. Business Analysis
  {
    id: "business_analysis",
    name: "Business Analysis & Market Sizing",
    department: "marketing",
    description: "Unit economics, customer acquisition cost (CAC), lifetime value (LTV), pricing models, and market opportunity sizing.",
    primarySpecializations: ["Unit Economics Modeling", "Pricing Strategy", "Competitive Moat Analysis", "TAM/SAM Sizing", "Churn Attribution"],
    defaultPermissions: ["read:business_metrics", "eval:economics", "synthesize:market"],
    riskLevel: "low",
  },
  // 49. Market & Customer Research (Simulated)
  {
    id: "market_customer_research",
    name: "Market & Customer Research (Simulated)",
    department: "customer_intelligence",
    description: "Simulated customer personas, market sentiment analysis, customer objection synthesis, and synthetic feedback loops.",
    primarySpecializations: ["Synthetic Persona Simulation", "Objection Analysis", "Jobs-to-be-Done (JTBD)", "Willingness to Pay (WTP)", "Sentiment Analysis"],
    defaultPermissions: ["simulate:personas", "eval:market_sentiment", "read:surveys"],
    riskLevel: "low",
  },
  // 50. Technical Program Management
  {
    id: "technical_program_management",
    name: "Technical Program Management (TPM)",
    department: "product",
    description: "Cross-functional dependency tracking, critical path analysis, milestone governance, and organizational blockers removal.",
    primarySpecializations: ["Dependency Matrix Mapping", "Critical Path Scheduling", "Risk Register Management", "Milestone Tracking", "Cross-Team Alignment"],
    defaultPermissions: ["read:programs", "eval:dependencies", "track:milestones"],
    riskLevel: "low",
  },
];
