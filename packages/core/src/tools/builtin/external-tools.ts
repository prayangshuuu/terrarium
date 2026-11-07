/**
 * @terrarium/core - tools/builtin/external-tools.ts
 *
 * Consequential external tools: publishing, production deployment, and notifications.
 * All require explicit human approval and security permissions.
 */

import {
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  ToolExecutionError,
} from "@terrarium/contracts";

export interface ExternalPublishInput {
  readonly packageName: string;
  readonly version: string;
  readonly registryUrl?: string;
  readonly dryRun?: boolean;
}

export interface ExternalPublishOutput {
  readonly packageName: string;
  readonly version: string;
  readonly published: boolean;
  readonly registryUrl: string;
}

export const externalPublishTool: ToolDefinition<ExternalPublishInput, ExternalPublishOutput> = {
  id: "publish.external",
  name: "Publish Package to External Registry",
  description: "Publishes a build artifact or package to an external registry. Requires explicit human approval.",
  category: "publishing",
  version: "1.0.0",
  riskLevel: "critical",
  sideEffectClass: "consequential",
  requiredPermissions: ["publish:external"],
  inputSchema: {
    type: "object",
    properties: {
      packageName: { type: "string", description: "Name of the package", required: true },
      version: { type: "string", description: "Semantic version string", required: true },
      registryUrl: { type: "string", default: "https://registry.npmjs.org", description: "Destination registry URL" },
      dryRun: { type: "boolean", default: false, description: "Simulate publish without network write" },
    },
    required: ["packageName", "version"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      packageName: { type: "string" },
      version: { type: "string" },
      published: { type: "boolean" },
      registryUrl: { type: "string" },
    },
    required: ["packageName", "version", "published", "registryUrl"],
  },
  defaultTimeoutMs: 30000,
  maxTimeoutMs: 120000,
  requiresApproval: true,
  isConsequential: true,
  async execute(input: ExternalPublishInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("publish.external", "Aborted by signal"));
    }
    return ok({
      packageName: input.packageName,
      version: input.version,
      published: true,
      registryUrl: input.registryUrl ?? "https://registry.npmjs.org",
    });
  },
};

export interface ProductionDeployInput {
  readonly environment: string;
  readonly serviceName: string;
  readonly tag: string;
}

export interface ProductionDeployOutput {
  readonly environment: string;
  readonly serviceName: string;
  readonly tag: string;
  readonly deployed: boolean;
  readonly deployedAt: string;
}

export const productionDeployTool: ToolDefinition<ProductionDeployInput, ProductionDeployOutput> = {
  id: "deploy.production",
  name: "Deploy Service to Production",
  description: "Deploys an application service to a production environment. Requires explicit human approval.",
  category: "deployment",
  version: "1.0.0",
  riskLevel: "critical",
  sideEffectClass: "consequential",
  requiredPermissions: ["deploy:production"],
  inputSchema: {
    type: "object",
    properties: {
      environment: { type: "string", description: "Target deployment environment (e.g. production, staging)", required: true },
      serviceName: { type: "string", description: "Identifier of service to deploy", required: true },
      tag: { type: "string", description: "Release image or git tag", required: true },
    },
    required: ["environment", "serviceName", "tag"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      environment: { type: "string" },
      serviceName: { type: "string" },
      tag: { type: "string" },
      deployed: { type: "boolean" },
      deployedAt: { type: "string" },
    },
    required: ["environment", "serviceName", "tag", "deployed", "deployedAt"],
  },
  defaultTimeoutMs: 60000,
  maxTimeoutMs: 300000,
  requiresApproval: true,
  isConsequential: true,
  async execute(input: ProductionDeployInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("deploy.production", "Aborted by signal"));
    }
    return ok({
      environment: input.environment,
      serviceName: input.serviceName,
      tag: input.tag,
      deployed: true,
      deployedAt: new Date().toISOString(),
    });
  },
};

export interface SendMessageInput {
  readonly recipient: string;
  readonly channel: string;
  readonly text: string;
}

export interface SendMessageOutput {
  readonly recipient: string;
  readonly channel: string;
  readonly delivered: boolean;
  readonly messageId: string;
}

export const sendMessageTool: ToolDefinition<SendMessageInput, SendMessageOutput> = {
  id: "message.send",
  name: "Send External Message",
  description: "Dispatches an external notification, email, or chat message to external recipients. Requires human approval.",
  category: "communication",
  version: "1.0.0",
  riskLevel: "high",
  sideEffectClass: "consequential",
  requiredPermissions: ["message:send"],
  inputSchema: {
    type: "object",
    properties: {
      recipient: { type: "string", description: "Target user, channel, or email address", required: true },
      channel: { type: "string", description: "Communication channel (e.g. email, slack)", required: true },
      text: { type: "string", description: "Message body text", required: true },
    },
    required: ["recipient", "channel", "text"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      recipient: { type: "string" },
      channel: { type: "string" },
      delivered: { type: "boolean" },
      messageId: { type: "string" },
    },
    required: ["recipient", "channel", "delivered", "messageId"],
  },
  defaultTimeoutMs: 10000,
  maxTimeoutMs: 30000,
  requiresApproval: true,
  isConsequential: true,
  async execute(input: SendMessageInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("message.send", "Aborted by signal"));
    }
    return ok({
      recipient: input.recipient,
      channel: input.channel,
      delivered: true,
      messageId: `msg-${Date.now()}`,
    });
  },
};
