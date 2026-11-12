/**
 * @terrarium/core - persistence/migrations/007_enhanced_reports_and_evidence.ts
 *
 * Migration adding enhanced report schema fields:
 * objective, method, evidence_json, sources_json, assumptions_json, confidence,
 * limitations_json, disagreements_json, recommendations_json, simulation tracking.
 * Aligns with PLAN.md Section 8 & 15 and PROMPT 18.
 */

export const MIGRATION_007_VERSION = 7;
export const MIGRATION_007_NAME = "007_enhanced_reports_and_evidence";

export const MIGRATION_007_UP = `
ALTER TABLE reports ADD COLUMN objective TEXT NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN method TEXT NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reports ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reports ADD COLUMN assumptions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reports ADD COLUMN confidence TEXT NOT NULL DEFAULT 'high';
ALTER TABLE reports ADD COLUMN confidence_rationale TEXT;
ALTER TABLE reports ADD COLUMN limitations_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reports ADD COLUMN disagreements_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reports ADD COLUMN recommendations_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE reports ADD COLUMN has_simulated_data INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN simulation_metadata_json TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_simulated ON reports(has_simulated_data);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
`;
