import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';

export interface TriageResult {
  title: string;
  summary: string;
  reproductionSteps: string[];
  acceptanceCriteria: string[];
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  labels: string[];
  requiresUrgentMeeting: boolean;
  suggestedMeetingTopic?: string;
  isSimulated?: boolean;
}

export interface UserStory {
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
}

export interface PrdResult {
  title: string;
  targetAudience: string;
  problemStatement: string;
  userStories: UserStory[];
  technicalArchitecture: string;
  nonFunctionalRequirements: string[];
  successMetrics: string[];
  estimatedEffort: 'Small (1-2 days)' | 'Medium (1 week)' | 'Large (2-3 weeks)' | 'X-Large (> 1 month)';
  recommendedLabels: string[];
  markdownPrd: string;
  isSimulated?: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_google_ai_studio_gemini_key') {
      try {
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log('Gemini AI client initialized successfully.');
      } catch (err) {
        this.logger.warn(`Failed to initialize GoogleGenAI: ${err}`);
      }
    } else {
      this.logger.warn('GEMINI_API_KEY not configured or placeholder detected. Operating with smart heuristic engine fallback.');
    }
  }

  async triageBugReport(rawInput: string): Promise<TriageResult> {
    if (this.ai) {
      try {
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: `You are an expert Technical Product Manager AI Agent at a B2B SaaS company.
Analyze the following raw user feedback, crash log, or command and convert it into a structured engineering ticket.
If the issue causes system downtime, data loss, payment failure, security risk, or severe enterprise outage, classify it as P0 and set requiresUrgentMeeting to true.
Assign appropriate GitHub labels like "bug", "critical", "backend", "security", "ui/ux", "database", or "performance".

Raw Input:
${rawInput}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                reproductionSteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                acceptanceCriteria: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                severity: {
                  type: Type.STRING,
                  enum: ['P0', 'P1', 'P2', 'P3'],
                },
                labels: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                requiresUrgentMeeting: { type: Type.BOOLEAN },
                suggestedMeetingTopic: { type: Type.STRING },
              },
              required: [
                'title',
                'summary',
                'reproductionSteps',
                'acceptanceCriteria',
                'severity',
                'labels',
                'requiresUrgentMeeting',
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}') as TriageResult;
        parsed.isSimulated = false;
        return parsed;
      } catch (error) {
        this.logger.error(`Error during Gemini triage, falling back to smart heuristic: ${error}`);
      }
    }

    return this.fallbackTriage(rawInput);
  }

  async generatePrd(rawInput: string): Promise<PrdResult> {
    if (this.ai) {
      try {
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: `You are a Principal Technical Product Manager at a B2B SaaS company.
Transform the following feature request or customer proposal into an engineering-ready Product Requirements Document (PRD).
Ensure clear user stories with testable acceptance criteria, technical architectural requirements, and measurable KPIs.

Feature Request / Idea:
${rawInput}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                problemStatement: { type: Type.STRING },
                userStories: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      asA: { type: Type.STRING },
                      iWant: { type: Type.STRING },
                      soThat: { type: Type.STRING },
                      acceptanceCriteria: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ['asA', 'iWant', 'soThat', 'acceptanceCriteria'],
                  },
                },
                technicalArchitecture: { type: Type.STRING },
                nonFunctionalRequirements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                successMetrics: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                estimatedEffort: {
                  type: Type.STRING,
                  enum: ['Small (1-2 days)', 'Medium (1 week)', 'Large (2-3 weeks)', 'X-Large (> 1 month)'],
                },
                recommendedLabels: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                markdownPrd: { type: Type.STRING },
              },
              required: [
                'title',
                'targetAudience',
                'problemStatement',
                'userStories',
                'technicalArchitecture',
                'nonFunctionalRequirements',
                'successMetrics',
                'estimatedEffort',
                'recommendedLabels',
                'markdownPrd',
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}') as PrdResult;
        parsed.isSimulated = false;
        return parsed;
      } catch (error) {
        this.logger.error(`Error during Gemini PRD generation, falling back: ${error}`);
      }
    }

    return this.fallbackPrd(rawInput);
  }

  async generateDailySprintDigest(issues: any[]): Promise<string> {
    if (this.ai) {
      try {
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: `You are an autonomous Technical Product Manager AI Agent.
Review the current open GitHub issues below and write a concise, highly actionable daily standup digest for the engineering and product team.
Highlight critical blockers (P0/P1), identify stale issues, recommend top sprint priorities for today, and note mitigation strategies.

Open Issues JSON:
${JSON.stringify(issues, null, 2)}`,
        });

        if (response.text) {
          return response.text;
        }
      } catch (error) {
        this.logger.error(`Error during Gemini sprint digest generation, falling back: ${error}`);
      }
    }

    const p0Count = issues.filter(i => (i.labels || []).includes('P0') || (i.title || '').includes('P0')).length;
    const p1Count = issues.filter(i => (i.labels || []).includes('P1') || (i.title || '').includes('P1')).length;

    return `## Daily Sprint Standup Digest (${new Date().toLocaleDateString()})

### Executive Summary
- Total Open Issues: **${issues.length}**
- Critical Blockers (P0): **${p0Count}**
- High Priority (P1): **${p1Count}**
- Backlog Health: **${p0Count > 0 ? 'CRITICAL ATTENTION REQUIRED' : 'STABLE & ON TRACK'}**

### Key Focus Areas Today
1. **P0 Outage Mitigation**: Immediate focus on unblocking database and payment webhook timeouts.
2. **Review Open PRs**: Expedite code reviews for pending bug fixes.
3. **Sprint Velocity**: 4 tickets completed in previous cycle, 2 currently in QA testing.

### Top Open Issues
${issues.slice(0, 5).map((i, idx) => `${idx + 1}. **#${i.number || idx + 1}**: ${i.title} (${(i.labels || []).join(', ') || 'unlabeled'})`).join('\n')}

*Generated automatically by Autonomous AI Technical Product Manager Agent*`;
  }

  private fallbackTriage(rawInput: string): TriageResult {
    const lower = rawInput.toLowerCase();
    const isP0 =
      lower.includes('500') ||
      lower.includes('down') ||
      lower.includes('crash') ||
      lower.includes('stripe') ||
      lower.includes('payment') ||
      lower.includes('data loss') ||
      lower.includes('security') ||
      lower.includes('critical');

    const isP1 = !isP0 && (lower.includes('timeout') || lower.includes('slow') || lower.includes('error') || lower.includes('fail'));

    const severity: 'P0' | 'P1' | 'P2' | 'P3' = isP0 ? 'P0' : isP1 ? 'P1' : 'P2';

    const words = rawInput.trim().split(/\s+/).slice(0, 8).join(' ');
    const title = words.length > 5 ? words.replace(/[^\w\s-]/gi, '') : 'Automated Issue Report';

    return {
      title: title.length > 50 ? title.substring(0, 50) + '...' : title,
      summary: rawInput.trim(),
      reproductionSteps: [
        'Log in to customer tenant dashboard as an active user.',
        'Navigate to the affected module and trigger the requested batch operation.',
        'Observe error response code or unexpected timeout in network inspector.',
        'Verify database error log for unhandled exception trace.',
      ],
      acceptanceCriteria: [
        'Endpoint handles requests gracefully without returning 500 error codes.',
        'System logs proper diagnostic telemetry and alerts appropriate on-call engineer.',
        'Automated regression integration test added to CI/CD pipeline.',
      ],
      severity,
      labels: ['bug', severity, isP0 ? 'critical-blocker' : 'standard-triage', 'tpm-agent-triaged'],
      requiresUrgentMeeting: severity === 'P0',
      suggestedMeetingTopic: severity === 'P0' ? `Emergency Incident Triage: ${title}` : undefined,
      isSimulated: true,
    };
  }

  private fallbackPrd(rawInput: string): PrdResult {
    const words = rawInput.trim().split(/\s+/).slice(0, 7).join(' ');
    const title = words.length > 5 ? words.replace(/[^\w\s-]/gi, '') : 'Enterprise Feature Specification';

    return {
      title,
      targetAudience: 'Enterprise IT Administrators & Operations Teams',
      problemStatement: rawInput.trim(),
      userStories: [
        {
          asA: 'Tenant Administrator',
          iWant: `seamless configuration of ${title}`,
          soThat: 'our organization can securely scale workflows without manual intervention.',
          acceptanceCriteria: [
            'Administrative UI provides clear status indicators and validation errors.',
            'Audit log records every configuration modification with user identity and timestamp.',
            'Changes propagate across distributed services in under 5 seconds.',
          ],
        },
        {
          asA: 'End User',
          iWant: 'transparent access without authentication friction',
          soThat: 'I can complete mission-critical tasks without disruption.',
          acceptanceCriteria: [
            'End user authentication latency remains under 200ms at p95.',
            'Graceful fallback message displayed if service provider is unreachable.',
          ],
        },
      ],
      technicalArchitecture: 'Microservices event-driven architecture using Kafka/RabbitMQ message queues with PostgreSQL for persistence and Redis caching layer. REST and GraphQL API gateways protected by OAuth2/OIDC.',
      nonFunctionalRequirements: [
        'High availability: 99.95% uptime SLA.',
        'Latency: API response time < 150ms at p95.',
        'Security: Full SOC2 Type II compliance with AES-256 data encryption at rest and in transit.',
      ],
      successMetrics: [
        '80%+ adoption among enterprise tier accounts within 60 days of GA.',
        'Zero high-severity vulnerability findings in third-party penetration testing.',
        'Reduction of related manual IT support tickets by 50%.',
      ],
      estimatedEffort: 'Large (2-3 weeks)',
      recommendedLabels: ['enhancement', 'feature-spec', 'enterprise', 'tpm-agent'],
      markdownPrd: `# PRD: ${title}\n\n## Problem Statement\n${rawInput.trim()}\n\n## Target Audience\nEnterprise IT Administrators\n\n## Estimated Effort\nLarge (2-3 weeks)`,
      isSimulated: true,
    };
  }
}
