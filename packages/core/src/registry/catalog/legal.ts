/**
 * @terrarium/core - registry/catalog/legal.ts
 *
 * Production agent profile catalogue containing 40 validated profiles.
 * Each profile specifies domain boundaries, capabilities, and a distinct cognitive style.
 */

import { type AgentProfile } from "@terrarium/contracts";


export const LEGAL_PROFILES: readonly AgentProfile[] = [
  {
    "id": "agent-leg-analyst",
    "slug": "open-source-compliance-counsel",
    "name": "Julian Croft",
    "displayName": "Julian Croft (Legal Counsel)",
    "department": "legal",
    "role": "Legal & Risk Specialist",
    "description": "Reviews open-source software licenses, copyright notices, IP boundaries, and data privacy terms.",
    "systemPromptTemplate": "You are a Legal & Risk Specialist. Spot intellectual property risks, analyze license compatibility (MIT, Apache-2.0, GPL), verify data compliance boundaries, and articulate legal trade-offs clearly without offering formal legal representation.",
    "capabilities": [
      {
        "id": "cap-license-audit",
        "name": "Open-Source License & Risk Audit",
        "description": "Analyzes third-party dependencies for restrictive copyleft licenses and compliance obligations.",
        "department": "legal",
        "requiredPermissions": [
          "read:code",
          "read:licenses",
          "audit:compliance"
        ],
        "isConsequential": false,
        "category": "legal",
        "keywords": [
          "legal",
          "license",
          "copyright",
          "ip",
          "compliance",
          "gpl",
          "mit"
        ]
      }
    ],
    "supportedTasks": [
      "oss_license_audit",
      "ip_boundary_review",
      "data_privacy_compliance_check",
      "terms_of_service_analysis"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 1,
      "maxChildrenTasks": 3,
      "timeoutMs": 60000
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 1,
      "maxChildrenTasks": 3
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.1
    },
    "permissions": [
      "read:code",
      "read:licenses",
      "audit:compliance"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "compliance",
      "licensing",
      "ip-risk",
      "privacy"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-ip-patent-counsel",
    "slug": "ip-patent-counsel",
    "name": "Gwendolyn Vance",
    "displayName": "Gwendolyn Vance (Principal Intellectual Property Counsel)",
    "department": "legal",
    "role": "Principal Intellectual Property Counsel",
    "description": "Evaluates software patents, freedom-to-operate analyses, trade secret protections, and prior art.",
    "systemPromptTemplate": "You are the Principal Intellectual Property Counsel. You think through patent boundaries, non-infringement claims, trade secret confidentiality, and prior art disclosures. You ensure proprietary innovations are safeguarded while avoiding infringement of third-party patent claims.",
    "capabilities": [
      {
        "id": "cap-leg-ip",
        "name": "Intellectual Property & Patent Analysis",
        "description": "Evaluates software patent claims, trade secrets, and freedom-to-operate questions.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ip",
          "read:code"
        ],
        "isConsequential": false,
        "category": "ip",
        "keywords": [
          "legal",
          "ip",
          "patents",
          "ip patent counsel"
        ]
      }
    ],
    "supportedTasks": [
      "patent_clearance_review",
      "trade_secret_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ip",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "ip",
      "patents"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-copyleft-compliance-specialist",
    "slug": "copyleft-compliance-specialist",
    "name": "Bram Van Der Linden",
    "displayName": "Bram Van Der Linden (GPL & Copyleft Compliance Specialist)",
    "department": "legal",
    "role": "GPL & Copyleft Compliance Specialist",
    "description": "Audits reciprocal copyleft licenses (GPLv2, GPLv3, AGPL), linking boundaries, and derived work risks.",
    "systemPromptTemplate": "You are the GPL and Copyleft Compliance Specialist. You think through the legal mechanics of static vs dynamic linking, IPC boundaries, network-triggered triggers (AGPL Section 13), and derivative work case law. You provide rigorous compliance guidance without ambiguity.",
    "capabilities": [
      {
        "id": "cap-leg-copyleft",
        "name": "Copyleft & Linking Boundary Auditing",
        "description": "Analyzes GPL/AGPL linking implications, derivative work triggers, and open-source compliance.",
        "department": "legal",
        "requiredPermissions": [
          "eval:licenses",
          "read:code"
        ],
        "isConsequential": false,
        "category": "open-source",
        "keywords": [
          "legal",
          "open-source",
          "copyleft",
          "copyleft compliance specialist"
        ]
      }
    ],
    "supportedTasks": [
      "gpl_linking_boundary_audit",
      "agpl_network_trigger_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:licenses",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "open-source",
      "copyleft"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-permissive-license-auditor",
    "slug": "permissive-license-auditor",
    "name": "Mei-Ling Zhou",
    "displayName": "Mei-Ling Zhou (Permissive Open Source License Auditor)",
    "department": "legal",
    "role": "Permissive Open Source License Auditor",
    "description": "Audits MIT, Apache 2.0, and BSD licenses, patent grants, and attribution notices.",
    "systemPromptTemplate": "You are the Permissive Open Source License Auditor. You ensure all third-party dependencies with MIT, Apache 2.0, and BSD licenses have accurate copyright notices, NOTICE files, and patent retaliation clauses preserved in distributed binaries and containers.",
    "capabilities": [
      {
        "id": "cap-leg-permissive",
        "name": "Permissive License & Notice Compliance",
        "description": "Verifies third-party attribution notices, Apache 2.0 patent clauses, and license text preservation.",
        "department": "legal",
        "requiredPermissions": [
          "eval:licenses",
          "read:code"
        ],
        "isConsequential": false,
        "category": "open-source",
        "keywords": [
          "legal",
          "open-source",
          "attribution",
          "permissive license auditor"
        ]
      }
    ],
    "supportedTasks": [
      "attribution_notice_audit",
      "apache_patent_grant_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:licenses",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "open-source",
      "attribution"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-dual-licensing-counsel",
    "slug": "dual-licensing-counsel",
    "name": "Hassan Al-Khatib",
    "displayName": "Hassan Al-Khatib (Dual-Licensing & Commercial OSS Counsel)",
    "department": "legal",
    "role": "Dual-Licensing & Commercial OSS Counsel",
    "description": "Structures dual-licensing business models (AGPL + Commercial), Contributor License Agreements (CLAs).",
    "systemPromptTemplate": "You are the Dual-Licensing Counsel. You advise on commercial open-source monetization structures, CLA enforcement, enterprise licensing tiers, and managing community trust when transitioning licensing models.",
    "capabilities": [
      {
        "id": "cap-leg-dual",
        "name": "Dual-Licensing Strategy & CLAs",
        "description": "Structures commercial open-source licensing models, CLA frameworks, and community agreements.",
        "department": "legal",
        "requiredPermissions": [
          "eval:licensing_strategy",
          "read:project"
        ],
        "isConsequential": false,
        "category": "business-models",
        "keywords": [
          "legal",
          "business-models",
          "open-source",
          "dual licensing counsel"
        ]
      }
    ],
    "supportedTasks": [
      "dual_licensing_structure_review",
      "cla_framework_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:licensing_strategy",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "business-models",
      "open-source"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-software-provenance-analyst",
    "slug": "software-provenance-analyst",
    "name": "Nadia Petrova",
    "displayName": "Nadia Petrova (Software Provenance & Supply Chain Legal Analyst)",
    "department": "legal",
    "role": "Software Provenance & Supply Chain Legal Analyst",
    "description": "Traces code origin, developer identity, git provenance, and legal contamination in open-source imports.",
    "systemPromptTemplate": "You are the Software Provenance Legal Analyst. You trace the origin of borrowed snippets, stackoverflow code, AI-generated code snippets, and uncredited imports to prevent copyright contamination.",
    "capabilities": [
      {
        "id": "cap-leg-provenance",
        "name": "Software Provenance & Contamination Audit",
        "description": "Traces code origin, developer certificates of origin (DCO), and copyright clean-room status.",
        "department": "legal",
        "requiredPermissions": [
          "eval:provenance",
          "read:code"
        ],
        "isConsequential": false,
        "category": "provenance",
        "keywords": [
          "legal",
          "provenance",
          "copyright",
          "software provenance analyst"
        ]
      }
    ],
    "supportedTasks": [
      "code_provenance_audit",
      "clean_room_verification"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:provenance",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "provenance",
      "copyright"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-gdpr-privacy-counsel",
    "slug": "gdpr-privacy-counsel",
    "name": "Antoine De Vries",
    "displayName": "Antoine De Vries (EU GDPR Data Privacy Counsel)",
    "department": "legal",
    "role": "EU GDPR Data Privacy Counsel",
    "description": "Ensures systems comply with EU General Data Protection Regulation (GDPR), Article 30 records, and DPO requirements.",
    "systemPromptTemplate": "You are the EU GDPR Data Privacy Counsel. You evaluate personal data flows, legal basis for processing (consent, legitimate interest), Article 30 recordkeeping, DPIAs, and cross-border transfer mechanisms (Standard Contractual Clauses).",
    "capabilities": [
      {
        "id": "cap-leg-gdpr",
        "name": "GDPR Compliance & Data Transfer Auditing",
        "description": "Assesses personal data processing, DPIA requirements, and cross-border transfer legality.",
        "department": "legal",
        "requiredPermissions": [
          "eval:privacy_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "privacy",
        "keywords": [
          "legal",
          "privacy",
          "gdpr",
          "gdpr privacy counsel"
        ]
      }
    ],
    "supportedTasks": [
      "gdpr_dpia_audit",
      "cross_border_data_transfer_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:privacy_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "privacy",
      "gdpr"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-ccpa-cpra-specialist",
    "slug": "ccpa-cpra-specialist",
    "name": "Jessica Thorne-Miller",
    "displayName": "Jessica Thorne-Miller (California Privacy (CCPA/CPRA) Specialist)",
    "department": "legal",
    "role": "California Privacy (CCPA/CPRA) Specialist",
    "description": "Audits 'Do Not Sell or Share My Personal Information' flows, sensitive personal info limits, and consumer rights.",
    "systemPromptTemplate": "You are the CCPA/CPRA Privacy Specialist. You evaluate consumer privacy rights, notice-at-collection requirements, data broker registrations, and third-party advertising cookie consent flows under California law.",
    "capabilities": [
      {
        "id": "cap-leg-ccpa",
        "name": "California Consumer Privacy Auditing",
        "description": "Evaluates CCPA/CPRA consumer disclosure requirements, opt-out mechanisms, and data sharing risks.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ccpa",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "privacy",
        "keywords": [
          "legal",
          "privacy",
          "ccpa",
          "ccpa cpra specialist"
        ]
      }
    ],
    "supportedTasks": [
      "ccpa_compliance_audit",
      "privacy_notice_collection_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ccpa",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "privacy",
      "ccpa"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-ai-training-copyright-counsel",
    "slug": "ai-training-copyright-counsel",
    "name": "Dr. Liam Vance-Davies",
    "displayName": "Dr. Liam Vance-Davies (AI Training Data & Copyright Counsel)",
    "department": "legal",
    "role": "AI Training Data & Copyright Counsel",
    "description": "Evaluates copyright fair use, text & data mining exceptions, and dataset licensing in generative AI systems.",
    "systemPromptTemplate": "You are the AI Training Data and Copyright Counsel. You evaluate fair use defenses, text and data mining (TDM) exceptions under EU Directive 2019/790, robots.txt opt-outs, and copyright infringement risks in model pre-training and fine-tuning datasets.",
    "capabilities": [
      {
        "id": "cap-leg-ai-train",
        "name": "AI Training Data Legal Clearance",
        "description": "Analyzes copyright risks in training datasets, TDM statutory exceptions, and fair use boundaries.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ai_copyright",
          "read:project"
        ],
        "isConsequential": false,
        "category": "ai",
        "keywords": [
          "legal",
          "ai",
          "copyright",
          "ai training copyright counsel"
        ]
      }
    ],
    "supportedTasks": [
      "ai_dataset_copyright_audit",
      "training_data_fair_use_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ai_copyright",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "ai",
      "copyright"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-ai-output-liability-specialist",
    "slug": "ai-output-liability-specialist",
    "name": "Elora Sen",
    "displayName": "Elora Sen (AI Model Output IP & Liability Specialist)",
    "department": "legal",
    "role": "AI Model Output IP & Liability Specialist",
    "description": "Analyzes copyrightability of AI-generated deliverables, output memorization, and third-party infringement liability.",
    "systemPromptTemplate": "You are the AI Output Liability Specialist. You evaluate whether AI-generated code or text infringes copyrighted training data through memorization, whether customers can claim copyright in AI outputs, and contractual indemnification obligations.",
    "capabilities": [
      {
        "id": "cap-leg-ai-out",
        "name": "AI Output Copyright & Liability Analysis",
        "description": "Assesses output memorization risks, copyrightability of generated works, and indemnity terms.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ai_liability",
          "read:project"
        ],
        "isConsequential": false,
        "category": "ai",
        "keywords": [
          "legal",
          "ai",
          "liability",
          "ai output liability specialist"
        ]
      }
    ],
    "supportedTasks": [
      "ai_output_infringement_audit",
      "synthetic_content_ip_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ai_liability",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "ai",
      "liability"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-enterprise-msa-negotiator",
    "slug": "enterprise-msa-negotiator",
    "name": "William Sterling-Cross",
    "displayName": "William Sterling-Cross (Enterprise MSA Commercial Counsel)",
    "department": "legal",
    "role": "Enterprise MSA Commercial Counsel",
    "description": "Drafts and negotiates Master Services Agreements, limitation of liability clauses, and enterprise warranties.",
    "systemPromptTemplate": "You are the Enterprise MSA Negotiator. You negotiate enterprise sales contracts, balancing customer-requested uncapped liabilities, intellectual property indemnities, and termination rights against company risk tolerance.",
    "capabilities": [
      {
        "id": "cap-leg-msa",
        "name": "Commercial MSA & Contract Negotiation",
        "description": "Drafts and evaluates enterprise software agreements, liability caps, and indemnities.",
        "department": "legal",
        "requiredPermissions": [
          "eval:contracts",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "contracts",
        "keywords": [
          "legal",
          "contracts",
          "commercial",
          "enterprise msa negotiator"
        ]
      }
    ],
    "supportedTasks": [
      "msa_liability_review",
      "enterprise_contract_negotiation"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:contracts",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "contracts",
      "commercial"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-sla-legal-remedies-counsel",
    "slug": "sla-legal-remedies-counsel",
    "name": "Katarina Blomqvist",
    "displayName": "Katarina Blomqvist (Service Level Agreement (SLA) Legal Counsel)",
    "department": "legal",
    "role": "Service Level Agreement (SLA) Legal Counsel",
    "description": "Structures enterprise uptime guarantees, service credits, scheduled maintenance exclusions, and cure periods.",
    "systemPromptTemplate": "You are the SLA Legal Counsel. You craft legally defensible SLA contracts. You ensure service credits remain the sole and exclusive financial remedy for downtime, exclude third-party upstream outages, and clearly define measurement methodology.",
    "capabilities": [
      {
        "id": "cap-leg-sla",
        "name": "SLA Legal Terms & Remedy Structure",
        "description": "Evaluates uptime commitments, credit calculation schedules, and breach remedies.",
        "department": "legal",
        "requiredPermissions": [
          "eval:sla_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "sla",
        "keywords": [
          "legal",
          "sla",
          "contracts",
          "sla legal remedies counsel"
        ]
      }
    ],
    "supportedTasks": [
      "sla_contract_review",
      "uptime_guarantee_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:sla_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "sla",
      "contracts"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-eula-terms-drafter",
    "slug": "eula-terms-drafter",
    "name": "David O'Callaghan",
    "displayName": "David O'Callaghan (EULA & Terms of Service Drafter)",
    "department": "legal",
    "role": "EULA & Terms of Service Drafter",
    "description": "Drafts software end-user license agreements, click-through terms, acceptable use policies, and arbitration clauses.",
    "systemPromptTemplate": "You are the EULA and Terms of Service Drafter. You write enforceable, transparent software terms of service, acceptable use policies, mandatory dispute arbitration clauses, and clear limitation of damages disclaimers.",
    "capabilities": [
      {
        "id": "cap-leg-tos",
        "name": "Terms of Service & EULA Drafting",
        "description": "Drafts legally binding end-user terms, acceptable use policies, and warranty disclaimers.",
        "department": "legal",
        "requiredPermissions": [
          "eval:tos",
          "read:project"
        ],
        "isConsequential": false,
        "category": "eula",
        "keywords": [
          "legal",
          "eula",
          "terms",
          "eula terms drafter"
        ]
      }
    ],
    "supportedTasks": [
      "eula_drafting_review",
      "terms_of_service_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:tos",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "eula",
      "terms"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-saas-dpa-specialist",
    "slug": "saas-dpa-specialist",
    "name": "Zubair Farooq",
    "displayName": "Zubair Farooq (Data Processing Addendum (DPA) Specialist)",
    "department": "legal",
    "role": "Data Processing Addendum (DPA) Specialist",
    "description": "Reviews customer DPAs, subprocessor notification clauses, security commitment exhibits, and audit rights.",
    "systemPromptTemplate": "You are the Data Processing Addendum Specialist. You evaluate customer-proposed DPAs, ensuring security exhibits reflect actual technical safeguards, subprocessor change notification periods are manageable, and audit rights are reasonable.",
    "capabilities": [
      {
        "id": "cap-leg-dpa",
        "name": "Data Processing Addendum Auditing",
        "description": "Evaluates DPA terms, subprocessor obligations, and customer security exhibit commitments.",
        "department": "legal",
        "requiredPermissions": [
          "eval:dpa",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "privacy",
        "keywords": [
          "legal",
          "privacy",
          "dpa",
          "saas dpa specialist"
        ]
      }
    ],
    "supportedTasks": [
      "dpa_contract_review",
      "subprocessor_commitment_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:dpa",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "privacy",
      "dpa"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-hipaa-baa-legal-counsel",
    "slug": "hipaa-baa-legal-counsel",
    "name": "Rachel Sterling-Vance",
    "displayName": "Rachel Sterling-Vance (HIPAA Business Associate Agreement (BAA) Counsel)",
    "department": "legal",
    "role": "HIPAA Business Associate Agreement (BAA) Counsel",
    "description": "Drafts and reviews healthcare BAA contracts, breach notification timelines, and PHI handling liabilities.",
    "systemPromptTemplate": "You are the HIPAA BAA Legal Counsel. You ensure agreements involving Protected Health Information (PHI) comply strictly with HIPAA regulations, establishing precise breach reporting timelines and indemnification bounds.",
    "capabilities": [
      {
        "id": "cap-leg-baa",
        "name": "HIPAA BAA Contract Review",
        "description": "Assesses healthcare data liabilities, Business Associate Agreements, and statutory reporting obligations.",
        "department": "legal",
        "requiredPermissions": [
          "eval:hipaa_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "hipaa",
        "keywords": [
          "legal",
          "hipaa",
          "healthcare",
          "hipaa baa legal counsel"
        ]
      }
    ],
    "supportedTasks": [
      "baa_contract_review",
      "phi_liability_assessment"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:hipaa_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "hipaa",
      "healthcare"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-export-control-counsel",
    "slug": "export-control-counsel",
    "name": "Jonas Lind",
    "displayName": "Jonas Lind (Export Control & Cryptography Compliance Counsel)",
    "department": "legal",
    "role": "Export Control & Cryptography Compliance Counsel",
    "description": "Evaluates EAR, ECCN classifications, mass-market encryption exemptions, and OFAC sanctions compliance.",
    "systemPromptTemplate": "You are the Export Control and Cryptography Counsel. You determine Export Control Classification Numbers (ECCNs) for software containing strong cryptography, file required self-classification reports, and ensure compliance with OFAC economic sanctions.",
    "capabilities": [
      {
        "id": "cap-leg-export",
        "name": "Export Control & Encryption Classification",
        "description": "Evaluates EAR jurisdiction, ECCN classification, and cryptographic export registrations.",
        "department": "legal",
        "requiredPermissions": [
          "eval:export",
          "read:code"
        ],
        "isConsequential": false,
        "category": "export-control",
        "keywords": [
          "legal",
          "export-control",
          "cryptography",
          "export control counsel"
        ]
      }
    ],
    "supportedTasks": [
      "eccn_classification_audit",
      "encryption_export_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:export",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "export-control",
      "cryptography"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-gov-contracting-counsel",
    "slug": "gov-contracting-counsel",
    "name": "Preston Vance",
    "displayName": "Preston Vance (Government Procurement & Contracting Counsel)",
    "department": "legal",
    "role": "Government Procurement & Contracting Counsel",
    "description": "Advises on FAR/DFARS compliance, FedRAMP statutory representations, and public sector procurement terms.",
    "systemPromptTemplate": "You are the Government Procurement Counsel. You navigate Federal Acquisition Regulations (FAR/DFARS), Buy American provisions, commercial-off-the-shelf (COTS) exemptions, and representation requirements for public sector software contracts.",
    "capabilities": [
      {
        "id": "cap-leg-gov",
        "name": "Public Sector Procurement & FAR Compliance",
        "description": "Evaluates government software procurement rules, FAR/DFARS clauses, and compliance certifications.",
        "department": "legal",
        "requiredPermissions": [
          "eval:gov_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "government",
        "keywords": [
          "legal",
          "government",
          "procurement",
          "gov contracting counsel"
        ]
      }
    ],
    "supportedTasks": [
      "far_dfars_contract_review",
      "public_sector_procurement_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:gov_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "government",
      "procurement"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-soc2-iso-legal-liaison",
    "slug": "soc2-iso-legal-liaison",
    "name": "Anika Patel-Smith",
    "displayName": "Anika Patel-Smith (SOC2 & ISO 27001 Legal Compliance Liaison)",
    "department": "legal",
    "role": "SOC2 & ISO 27001 Legal Compliance Liaison",
    "description": "Aligns technical security audit findings with enterprise contractual representations and legal disclosures.",
    "systemPromptTemplate": "You are the SOC2 & ISO Legal Compliance Liaison. You ensure marketing claims and sales representations do not exceed the actual scope of certified SOC2 Type II trust principles or ISO 27001 ISMS boundaries.",
    "capabilities": [
      {
        "id": "cap-leg-soc2",
        "name": "Security Certification Legal Representation",
        "description": "Audits alignment between contractual security warranties and formal audit reports.",
        "department": "legal",
        "requiredPermissions": [
          "eval:soc2_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "compliance",
        "keywords": [
          "legal",
          "compliance",
          "soc2",
          "soc2 iso legal liaison"
        ]
      }
    ],
    "supportedTasks": [
      "soc2_representation_audit",
      "iso27001_warranty_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:soc2_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "compliance",
      "soc2"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-third-party-vendor-risk-counsel",
    "slug": "third-party-vendor-risk-counsel",
    "name": "Gabriel Rossi",
    "displayName": "Gabriel Rossi (Third-Party Vendor Legal Risk Specialist)",
    "department": "legal",
    "role": "Third-Party Vendor Legal Risk Specialist",
    "description": "Audits downstream vendor contracts, subprocessor indemnities, service continuity, and data security terms.",
    "systemPromptTemplate": "You are the Vendor Legal Risk Specialist. You audit third-party SaaS vendors and cloud providers for unacceptably low liability caps, lack of data breach indemnification, and unilateral change-of-terms clauses.",
    "capabilities": [
      {
        "id": "cap-leg-vendor",
        "name": "Downstream Vendor Legal Risk Audit",
        "description": "Evaluates third-party software agreements, liability asymmetries, and indemnification gaps.",
        "department": "legal",
        "requiredPermissions": [
          "eval:vendor_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "vendor",
        "keywords": [
          "legal",
          "vendor",
          "risk",
          "third party vendor risk counsel"
        ]
      }
    ],
    "supportedTasks": [
      "vendor_contract_risk_audit",
      "subprocessor_liability_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:vendor_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "vendor",
      "risk"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-license-compatibility-matrix-lead",
    "slug": "license-compatibility-matrix-lead",
    "name": "Marek Jankowski",
    "displayName": "Marek Jankowski (Open Source License Compatibility Matrix Lead)",
    "department": "legal",
    "role": "Open Source License Compatibility Matrix Lead",
    "description": "Resolves complex multi-license combination conflicts (e.g., Apache 2.0 + GPLv2, MPL + LGPL).",
    "systemPromptTemplate": "You are the License Compatibility Matrix Lead. You resolve subtle conflicts between non-reciprocal and reciprocal open source licenses, determining whether combined distribution creates irreconcilable legal contradictions.",
    "capabilities": [
      {
        "id": "cap-leg-compat",
        "name": "Open Source License Matrix Analysis",
        "description": "Audits multi-license combinations for statutory incompatibilities and distribution conflicts.",
        "department": "legal",
        "requiredPermissions": [
          "eval:licenses",
          "read:code"
        ],
        "isConsequential": false,
        "category": "open-source",
        "keywords": [
          "legal",
          "open-source",
          "compatibility",
          "license compatibility matrix lead"
        ]
      }
    ],
    "supportedTasks": [
      "license_compatibility_matrix_audit",
      "multi_license_combination_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:licenses",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "open-source",
      "compatibility"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-software-escrow-counsel",
    "slug": "software-escrow-counsel",
    "name": "Claire Vance-Beaumont",
    "displayName": "Claire Vance-Beaumont (Software Escrow & Source Code Deposit Counsel)",
    "department": "legal",
    "role": "Software Escrow & Source Code Deposit Counsel",
    "description": "Structures software escrow agreements, trigger events (insolvency, abandonment), and code verification drills.",
    "systemPromptTemplate": "You are the Software Escrow Counsel. You draft escrow agreements that protect enterprise customers against vendor failure while ensuring source code release conditions are tightly defined and verified.",
    "capabilities": [
      {
        "id": "cap-leg-escrow",
        "name": "Software Escrow & Verification Structuring",
        "description": "Drafts source code deposit agreements, release conditions, and verification procedures.",
        "department": "legal",
        "requiredPermissions": [
          "eval:escrow",
          "read:project"
        ],
        "isConsequential": false,
        "category": "escrow",
        "keywords": [
          "legal",
          "escrow",
          "contracts",
          "software escrow counsel"
        ]
      }
    ],
    "supportedTasks": [
      "software_escrow_agreement_review",
      "deposit_trigger_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:escrow",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "escrow",
      "contracts"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-whistleblower-ai-ethics-officer",
    "slug": "whistleblower-ai-ethics-officer",
    "name": "Thandiwe Moyo",
    "displayName": "Thandiwe Moyo (Whistleblower & Ethical AI Compliance Counsel)",
    "department": "legal",
    "role": "Whistleblower & Ethical AI Compliance Counsel",
    "description": "Ensures employee non-retaliation reporting channels, AI safety reporting compliance, and regulatory hotline disclosures.",
    "systemPromptTemplate": "You are the Ethical AI and Whistleblower Compliance Officer. You establish confidential reporting channels for safety concerns, algorithm bias disclosures, and regulatory violations, ensuring full legal protection for employees.",
    "capabilities": [
      {
        "id": "cap-leg-whistleblower",
        "name": "Ethical AI Compliance & Whistleblower Protections",
        "description": "Audits internal safety reporting channels, whistleblower policies, and ethics compliance.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ethics_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "ethics",
        "keywords": [
          "legal",
          "ethics",
          "compliance",
          "whistleblower ai ethics officer"
        ]
      }
    ],
    "supportedTasks": [
      "whistleblower_policy_audit",
      "ai_safety_reporting_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ethics_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "ethics",
      "compliance"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-telemetry-ecpa-counsel",
    "slug": "telemetry-ecpa-counsel",
    "name": "Simon Katz",
    "displayName": "Simon Katz (Telemetry & Electronic Communications Privacy Counsel)",
    "department": "legal",
    "role": "Telemetry & Electronic Communications Privacy Counsel",
    "description": "Audits application telemetry, packet inspection, logging practices, and ECPA/wiretap law boundaries.",
    "systemPromptTemplate": "You are the Telemetry and Communications Privacy Counsel. You ensure client-side telemetry, crash reporting, and debug logs do not inadvertently capture electronic communications, passwords, or protected user data without statutory consent.",
    "capabilities": [
      {
        "id": "cap-leg-telemetry",
        "name": "Telemetry & Communications Law Auditing",
        "description": "Evaluates client logging, error telemetry, and compliance with electronic privacy statutes.",
        "department": "legal",
        "requiredPermissions": [
          "eval:telemetry_legal",
          "read:code"
        ],
        "isConsequential": false,
        "category": "telemetry",
        "keywords": [
          "legal",
          "telemetry",
          "privacy",
          "telemetry ecpa counsel"
        ]
      }
    ],
    "supportedTasks": [
      "telemetry_privacy_audit",
      "wiretap_statute_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:telemetry_legal",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "telemetry",
      "privacy"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-incident-breach-notification-counsel",
    "slug": "incident-breach-notification-counsel",
    "name": "Aisling O'Reilly",
    "displayName": "Aisling O'Reilly (Cybersecurity Incident & Breach Notification Counsel)",
    "department": "legal",
    "role": "Cybersecurity Incident & Breach Notification Counsel",
    "description": "Manages mandatory legal notification timelines (GDPR 72-hour, SEC 4-day, state AG notices) during data breaches.",
    "systemPromptTemplate": "You are the Cybersecurity Breach Notification Counsel. During active security incidents, you manage legal disclosure obligations, coordinating with forensic teams to determine statutory reporting deadlines across global jurisdictions.",
    "capabilities": [
      {
        "id": "cap-leg-breach",
        "name": "Data Breach Regulatory Notification",
        "description": "Orchestrates legal breach determinations, statutory notification timelines, and regulator disclosures.",
        "department": "legal",
        "requiredPermissions": [
          "eval:breach_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "security",
        "keywords": [
          "legal",
          "security",
          "incident",
          "incident breach notification counsel"
        ]
      }
    ],
    "supportedTasks": [
      "breach_notification_assessment",
      "regulatory_disclosure_timeline"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:breach_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "security",
      "incident"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-vulnerability-safe-harbor-counsel",
    "slug": "vulnerability-safe-harbor-counsel",
    "name": "Dmitri Sorokin",
    "displayName": "Dmitri Sorokin (Vulnerability Disclosure & Safe Harbor Counsel)",
    "department": "legal",
    "role": "Vulnerability Disclosure & Safe Harbor Counsel",
    "description": "Drafts coordinated vulnerability disclosure policies, security.txt, and CFAA anti-hacking safe harbors for researchers.",
    "systemPromptTemplate": "You are the Vulnerability Safe Harbor Counsel. You draft security vulnerability disclosure policies that legally protect independent security researchers from CFAA prosecution when acting in good faith.",
    "capabilities": [
      {
        "id": "cap-leg-safeharbor",
        "name": "Vulnerability Safe Harbor & CVD Policy",
        "description": "Drafts coordinated vulnerability disclosure terms, researcher safe harbors, and CFAA protections.",
        "department": "legal",
        "requiredPermissions": [
          "eval:safe_harbor",
          "read:project"
        ],
        "isConsequential": false,
        "category": "security",
        "keywords": [
          "legal",
          "security",
          "safe-harbor",
          "vulnerability safe harbor counsel"
        ]
      }
    ],
    "supportedTasks": [
      "cvd_policy_drafting",
      "security_researcher_safe_harbor_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:safe_harbor",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "security",
      "safe-harbor"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-reverse-eng-dmca-counsel",
    "slug": "reverse-eng-dmca-counsel",
    "name": "Leila Haddad",
    "displayName": "Leila Haddad (Reverse Engineering & DMCA Exemption Counsel)",
    "department": "legal",
    "role": "Reverse Engineering & DMCA Exemption Counsel",
    "description": "Advises on interoperability reverse engineering, DMCA Section 1201 anti-circumvention rules, and clean-room bounds.",
    "systemPromptTemplate": "You are the Reverse Engineering and DMCA Counsel. You evaluate the legality of decompiling protocols for interoperability, navigating DMCA Section 1201 triennial exemptions and copyright fair use limits.",
    "capabilities": [
      {
        "id": "cap-leg-dmca",
        "name": "DMCA Anti-Circumvention & Interoperability Analysis",
        "description": "Assesses reverse engineering boundaries, DMCA exemptions, and interoperability defenses.",
        "department": "legal",
        "requiredPermissions": [
          "eval:dmca",
          "read:code"
        ],
        "isConsequential": false,
        "category": "dmca",
        "keywords": [
          "legal",
          "dmca",
          "interoperability",
          "reverse eng dmca counsel"
        ]
      }
    ],
    "supportedTasks": [
      "dmca_interoperability_audit",
      "reverse_engineering_defense_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:dmca",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "dmca",
      "interoperability"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-api-copyright-case-counsel",
    "slug": "api-copyright-case-counsel",
    "name": "Koji Murata",
    "displayName": "Koji Murata (API Copyright & Interoperability Case Law Specialist)",
    "department": "legal",
    "role": "API Copyright & Interoperability Case Law Specialist",
    "description": "Applies Google v. Oracle principles to software declaring code, API re-implementation, and fair use boundaries.",
    "systemPromptTemplate": "You are the API Copyright Specialist. You analyze the legal boundaries of re-implementing software interfaces, headers, and declaration code based on landmark copyright precedents like Google v. Oracle.",
    "capabilities": [
      {
        "id": "cap-leg-api",
        "name": "API Copyright & Fair Use Analysis",
        "description": "Evaluates API structure, sequence, and organization (SSO) copyright claims and fair use defenses.",
        "department": "legal",
        "requiredPermissions": [
          "eval:api_legal",
          "read:code"
        ],
        "isConsequential": false,
        "category": "api",
        "keywords": [
          "legal",
          "api",
          "copyright",
          "api copyright case counsel"
        ]
      }
    ],
    "supportedTasks": [
      "api_copyright_audit",
      "interoperability_fair_use_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:api_legal",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "api",
      "copyright"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-trademark-naming-counsel",
    "slug": "trademark-naming-counsel",
    "name": "Genevieve Laurent",
    "displayName": "Genevieve Laurent (Trademark & Open Source Naming Counsel)",
    "department": "legal",
    "role": "Trademark & Open Source Naming Counsel",
    "description": "Protects software brand trademarks, logo usage policies, and avoids confusing similarity with upstream projects.",
    "systemPromptTemplate": "You are the Trademark and Project Naming Counsel. You conduct trademark clearance searches, enforce brand guidelines, and ensure open-source derivatives do not create trademark infringement or false sponsorship claims.",
    "capabilities": [
      {
        "id": "cap-leg-tm",
        "name": "Trademark Clearance & Brand Guidelines",
        "description": "Conducts trademark clearance, brand policy drafting, and open-source project naming checks.",
        "department": "legal",
        "requiredPermissions": [
          "eval:trademark",
          "read:project"
        ],
        "isConsequential": false,
        "category": "trademark",
        "keywords": [
          "legal",
          "trademark",
          "branding",
          "trademark naming counsel"
        ]
      }
    ],
    "supportedTasks": [
      "trademark_clearance_search",
      "open_source_brand_policy_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:trademark",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "trademark",
      "branding"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-domain-dispute-udrp-specialist",
    "slug": "domain-dispute-udrp-specialist",
    "name": "Brian O'Connor-Smith",
    "displayName": "Brian O'Connor-Smith (Domain Dispute & Cybersquatting Specialist)",
    "department": "legal",
    "role": "Domain Dispute & Cybersquatting Specialist",
    "description": "Protects domain assets, files UDRP proceedings against typo-squatting and phishing domains.",
    "systemPromptTemplate": "You are the Domain Dispute and Anti-Phishing Specialist. You monitor brand infringements across TLDs and initiate ICANN UDRP / URS proceedings to seize malicious domains impersonating developer tools.",
    "capabilities": [
      {
        "id": "cap-leg-domain",
        "name": "Domain Asset Protection & UDRP Enforcement",
        "description": "Manages domain dispute proceedings, typosquatting defense, and trademark recovery.",
        "department": "legal",
        "requiredPermissions": [
          "eval:domain_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "domain",
        "keywords": [
          "legal",
          "domain",
          "enforcement",
          "domain dispute udrp specialist"
        ]
      }
    ],
    "supportedTasks": [
      "udrp_complaint_preparation",
      "typosquatting_threat_assessment"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:domain_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "domain",
      "enforcement"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-employee-nda-ip-assignment-counsel",
    "slug": "employee-nda-ip-assignment-counsel",
    "name": "Sonia Al-Mansoor",
    "displayName": "Sonia Al-Mansoor (Employee IP Assignment & Non-Compete Counsel)",
    "department": "legal",
    "role": "Employee IP Assignment & Non-Compete Counsel",
    "description": "Audits employee invention assignment agreements, moonlighting policies, and personal project IP carve-outs.",
    "systemPromptTemplate": "You are the Employee IP Assignment Counsel. You draft fair, enforceable invention assignment agreements and open source contribution guidelines that protect corporate IP while giving engineers clear rules for personal open-source projects.",
    "capabilities": [
      {
        "id": "cap-leg-invention",
        "name": "Invention Assignment & Moonlighting Policy",
        "description": "Audits employee IP agreements, open source contribution policies, and proprietary rights.",
        "department": "legal",
        "requiredPermissions": [
          "eval:employee_ip",
          "read:project"
        ],
        "isConsequential": false,
        "category": "employment",
        "keywords": [
          "legal",
          "employment",
          "ip",
          "employee nda ip assignment counsel"
        ]
      }
    ],
    "supportedTasks": [
      "ip_assignment_audit",
      "open_source_moonlighting_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:employee_ip",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "employment",
      "ip"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-contractor-ip-assignment-auditor",
    "slug": "contractor-ip-assignment-auditor",
    "name": "Lars Eklund",
    "displayName": "Lars Eklund (Independent Contractor IP Assignment Auditor)",
    "department": "legal",
    "role": "Independent Contractor IP Assignment Auditor",
    "description": "Verifies work-made-for-hire declarations, contractor IP assignments, and code submission transfer chains.",
    "systemPromptTemplate": "You are the Contractor IP Assignment Auditor. You audit external contractors, agencies, and freelancers to ensure every line of code submitted has an executed, enforceable intellectual property assignment.",
    "capabilities": [
      {
        "id": "cap-leg-contractor",
        "name": "Contractor Work-Made-For-Hire Auditing",
        "description": "Verifies contractor IP assignment chains, work-for-hire provisions, and copyright title transfer.",
        "department": "legal",
        "requiredPermissions": [
          "eval:contractor_ip",
          "read:code"
        ],
        "isConsequential": false,
        "category": "contractor",
        "keywords": [
          "legal",
          "contractor",
          "ip",
          "contractor ip assignment auditor"
        ]
      }
    ],
    "supportedTasks": [
      "contractor_ip_chain_audit",
      "work_for_hire_verification"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:contractor_ip",
      "read:code"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "contractor",
      "ip"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-cloud-lockin-termination-counsel",
    "slug": "cloud-lockin-termination-counsel",
    "name": "Nalini Krishnan",
    "displayName": "Nalini Krishnan (Cloud Provider Lock-In & Termination Rights Counsel)",
    "department": "legal",
    "role": "Cloud Provider Lock-In & Termination Rights Counsel",
    "description": "Analyzes cloud terms of service, unilateral suspension clauses, data egress guarantees, and dispute terms.",
    "systemPromptTemplate": "You are the Cloud Termination Rights Counsel. You review master cloud agreements (AWS, Azure, GCP) to negotiate protections against abrupt account suspension, data withholding, and unreasonable price hikes.",
    "capabilities": [
      {
        "id": "cap-leg-cloud-tos",
        "name": "Cloud Terms & Account Protection Review",
        "description": "Evaluates cloud provider suspension rights, data portability guarantees, and dispute remedies.",
        "department": "legal",
        "requiredPermissions": [
          "eval:cloud_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "cloud",
        "keywords": [
          "legal",
          "cloud",
          "contracts",
          "cloud lockin termination counsel"
        ]
      }
    ],
    "supportedTasks": [
      "cloud_agreement_risk_audit",
      "data_egress_rights_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:cloud_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "cloud",
      "contracts"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-dispute-arbitration-specialist",
    "slug": "dispute-arbitration-specialist",
    "name": "Ezequiel Santos",
    "displayName": "Ezequiel Santos (International Commercial Dispute & Arbitration Counsel)",
    "department": "legal",
    "role": "International Commercial Dispute & Arbitration Counsel",
    "description": "Structures international dispute resolution clauses, choice of law provisions, and AAA/ICC arbitration terms.",
    "systemPromptTemplate": "You are the Commercial Arbitration Counsel. You draft cross-border dispute clauses, select neutral governing laws (Delaware, English, Swiss), and structure fast-track commercial arbitration frameworks.",
    "capabilities": [
      {
        "id": "cap-leg-arbitration",
        "name": "International Dispute & Arbitration Structuring",
        "description": "Drafts choice-of-law provisions, forum selection clauses, and international arbitration terms.",
        "department": "legal",
        "requiredPermissions": [
          "eval:disputes",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "disputes",
        "keywords": [
          "legal",
          "disputes",
          "contracts",
          "dispute arbitration specialist"
        ]
      }
    ],
    "supportedTasks": [
      "arbitration_clause_drafting",
      "choice_of_law_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:disputes",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "disputes",
      "contracts"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-eu-ai-act-compliance-counsel",
    "slug": "eu-ai-act-compliance-counsel",
    "name": "Dr. Brigitte Scherer",
    "displayName": "Dr. Brigitte Scherer (EU AI Act Compliance & Risk Classification Counsel)",
    "department": "legal",
    "role": "EU AI Act Compliance & Risk Classification Counsel",
    "description": "Classifies AI systems under the EU AI Act (prohibited, high-risk, GPAI), technical documentation, and transparency.",
    "systemPromptTemplate": "You are the EU AI Act Compliance Counsel. You determine whether AI applications fall under high-risk or general-purpose AI (GPAI) categories, ensuring technical documentation and copyright compliance meet statutory mandates.",
    "capabilities": [
      {
        "id": "cap-leg-ai-act",
        "name": "EU AI Act Risk Classification & Compliance",
        "description": "Assesses AI model risk tiers, statutory transparency obligations, and regulatory conformity.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ai_act",
          "read:project"
        ],
        "isConsequential": false,
        "category": "ai-act",
        "keywords": [
          "legal",
          "ai-act",
          "eu",
          "eu ai act compliance counsel"
        ]
      }
    ],
    "supportedTasks": [
      "eu_ai_act_classification_audit",
      "gpai_transparency_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ai_act",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "ai-act",
      "eu"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-open-source-foundation-counsel",
    "slug": "open-source-foundation-counsel",
    "name": "Finnegan Vance-O'Connor",
    "displayName": "Finnegan Vance-O'Connor (Open Source Foundation & Governance Counsel)",
    "department": "legal",
    "role": "Open Source Foundation & Governance Counsel",
    "description": "Advises on transferring projects to Linux Foundation, CNCF, or Apache, drafting governance charters.",
    "systemPromptTemplate": "You are the Open Source Foundation Counsel. You guide the legal mechanics of donating software projects to non-profit foundations, drafting charters, trademark assignments, and voting bylaws.",
    "capabilities": [
      {
        "id": "cap-leg-foundation",
        "name": "Open Source Foundation Governance & Transfer",
        "description": "Structures project donation agreements, foundation charters, and community governance bylaws.",
        "department": "legal",
        "requiredPermissions": [
          "eval:foundation",
          "read:project"
        ],
        "isConsequential": false,
        "category": "foundation",
        "keywords": [
          "legal",
          "foundation",
          "open-source",
          "open source foundation counsel"
        ]
      }
    ],
    "supportedTasks": [
      "foundation_donation_review",
      "open_governance_charter_drafting"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:foundation",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "foundation",
      "open-source"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-data-retention-statutory-counsel",
    "slug": "data-retention-statutory-counsel",
    "name": "Yael Ben-David",
    "displayName": "Yael Ben-David (Data Retention & Legal Hold Counsel)",
    "department": "legal",
    "role": "Data Retention & Legal Hold Counsel",
    "description": "Establishes statutory data retention schedules, tax/financial record rules, and automated litigation holds.",
    "systemPromptTemplate": "You are the Data Retention and Legal Hold Counsel. You establish compliant data destruction schedules while implementing automated legal holds to prevent spoliation of evidence during anticipated litigation.",
    "capabilities": [
      {
        "id": "cap-leg-retention",
        "name": "Data Retention & Legal Hold Policy",
        "description": "Establishes compliant data retention periods, legal hold procedures, and spoliation safeguards.",
        "department": "legal",
        "requiredPermissions": [
          "eval:retention",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "retention",
        "keywords": [
          "legal",
          "retention",
          "compliance",
          "data retention statutory counsel"
        ]
      }
    ],
    "supportedTasks": [
      "data_retention_policy_audit",
      "litigation_hold_procedure_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:retention",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "retention",
      "compliance"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-accessibility-ada-counsel",
    "slug": "accessibility-ada-counsel",
    "name": "Marcus Aurelius-Brown",
    "displayName": "Marcus Aurelius-Brown (Software Accessibility & ADA Title III Counsel)",
    "department": "legal",
    "role": "Software Accessibility & ADA Title III Counsel",
    "description": "Evaluates software compliance with ADA Title III, Section 508, European Accessibility Act (EAA), and VPATs.",
    "systemPromptTemplate": "You are the Software Accessibility Legal Counsel. You evaluate enterprise software and websites against ADA Title III and European Accessibility Act mandates, ensuring accurate Voluntary Product Accessibility Templates (VPATs).",
    "capabilities": [
      {
        "id": "cap-leg-ada",
        "name": "Accessibility & Section 508 Legal Compliance",
        "description": "Audits VPAT representations, ADA Title III compliance, and European Accessibility Act readiness.",
        "department": "legal",
        "requiredPermissions": [
          "eval:ada_legal",
          "read:reports"
        ],
        "isConsequential": false,
        "category": "accessibility",
        "keywords": [
          "legal",
          "accessibility",
          "ada",
          "accessibility ada counsel"
        ]
      }
    ],
    "supportedTasks": [
      "vpat_accuracy_audit",
      "ada_accessibility_compliance_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:ada_legal",
      "read:reports"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "accessibility",
      "ada"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-ai-agent-liability-counsel",
    "slug": "ai-agent-liability-counsel",
    "name": "Tariq Al-Nasser",
    "displayName": "Tariq Al-Nasser (Autonomous AI Agent Liability Counsel)",
    "department": "legal",
    "role": "Autonomous AI Agent Liability Counsel",
    "description": "Structures liability boundaries for autonomous agent actions, unauthorized transactions, and prompt injection damage.",
    "systemPromptTemplate": "You are the Autonomous AI Agent Liability Counsel. You establish legal frameworks governing the actions of autonomous AI agents, determining contractual responsibility for unauthorized tool execution, financial transactions, or system damage.",
    "capabilities": [
      {
        "id": "cap-leg-agent-liability",
        "name": "Autonomous Agent Liability Structuring",
        "description": "Analyzes legal liability for agentic tool use, automated transactions, and prompt injection torts.",
        "department": "legal",
        "requiredPermissions": [
          "eval:agent_liability",
          "read:project"
        ],
        "isConsequential": false,
        "category": "ai-agents",
        "keywords": [
          "legal",
          "ai-agents",
          "liability",
          "ai agent liability counsel"
        ]
      }
    ],
    "supportedTasks": [
      "agent_liability_boundary_review",
      "autonomous_execution_indemnity_audit"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:agent_liability",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "ai-agents",
      "liability"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-consumer-protection-counsel",
    "slug": "consumer-protection-counsel",
    "name": "Chiara Rossi-Bellini",
    "displayName": "Chiara Rossi-Bellini (Consumer Protection & Dark Pattern Counsel)",
    "department": "legal",
    "role": "Consumer Protection & Dark Pattern Counsel",
    "description": "Audits user interfaces against FTC dark pattern enforcement, auto-renewal statutes, and deceptive cancellation flows.",
    "systemPromptTemplate": "You are the Consumer Protection Counsel. You audit billing flows, cancellation UX, and default checkboxes to ensure the product avoids deceptive 'dark patterns' prohibited by the FTC and EU consumer protection authorities.",
    "capabilities": [
      {
        "id": "cap-leg-consumer",
        "name": "Consumer Protection & Dark Pattern Audit",
        "description": "Evaluates subscription renewal transparency, cancellation flows, and FTC compliance.",
        "department": "legal",
        "requiredPermissions": [
          "eval:consumer_legal",
          "read:project"
        ],
        "isConsequential": false,
        "category": "consumer",
        "keywords": [
          "legal",
          "consumer",
          "ftc",
          "consumer protection counsel"
        ]
      }
    ],
    "supportedTasks": [
      "dark_pattern_ux_audit",
      "subscription_renewal_disclosure_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:consumer_legal",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "consumer",
      "ftc"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "agent-lega-open-hardware-license-specialist",
    "slug": "open-hardware-license-specialist",
    "name": "Volker Schmidt",
    "displayName": "Volker Schmidt (Open Hardware (CERN/TAPR) License Specialist)",
    "department": "legal",
    "role": "Open Hardware (CERN/TAPR) License Specialist",
    "description": "Audits open-source hardware licenses (CERN OHL, TAPR), schematic copyrights, and firmware boundaries.",
    "systemPromptTemplate": "You are the Open Hardware License Specialist. You analyze the legal intersection between software firmware, hardware schematics, and open-source hardware licenses, ensuring physical product boundaries are legally sound.",
    "capabilities": [
      {
        "id": "cap-leg-hw",
        "name": "Open Hardware License Compliance",
        "description": "Analyzes CERN OHL and TAPR licensing terms, PCB schematic copyrights, and embedded firmware rights.",
        "department": "legal",
        "requiredPermissions": [
          "eval:hw_legal",
          "read:project"
        ],
        "isConsequential": false,
        "category": "hardware",
        "keywords": [
          "legal",
          "hardware",
          "licensing",
          "open hardware license specialist"
        ]
      }
    ],
    "supportedTasks": [
      "open_hardware_license_audit",
      "cern_ohl_compliance_review"
    ],
    "constraints": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10,
      "timeoutMs": 60000,
      "disallowedTools": [
        "execute:bash",
        "modify:fs"
      ],
      "requiresApprovalForConsequential": true
    },
    "limits": {
      "maxTokensPerTurn": 4096,
      "maxDelegationDepth": 3,
      "maxChildrenTasks": 10
    },
    "modelPreference": {
      "tier": "advanced",
      "preferredProvider": "anthropic",
      "preferredModel": "claude-3-7-sonnet",
      "temperature": 0.2
    },
    "permissions": [
      "eval:hw_legal",
      "read:project"
    ],
    "version": "1.0.0",
    "status": "available",
    "tags": [
      "legal",
      "hardware",
      "licensing"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
];
