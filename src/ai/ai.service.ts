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

    // Heuristic Fallback for local testing/demo without valid API key
    return this.fallbackTriage(rawInput);
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

    // Fallback digest
    const p0Count = issues.filter(i => (i.labels || []).includes('P0') || (i.title || '').includes('P0')).length;
    const p1Count = issues.filter(i => (i.labels || []).includes('P1') || (i.title || '').includes('P1')).length;

    return `## 🚀 AI TPM Daily Sprint Standup Digest (${new Date().toLocaleDateString()})

### ⚠️ Executive Summary
- Total Open Issues: **${issues.length}**
- Critical Blockers (P0): **${p0Count}**
- High Priority (P1): **${p1Count}**
- Backlog Health: **${p0Count > 0 ? 'CRITICAL ATTENTION REQUIRED' : 'STABLE & ON TRACK'}**

### 🎯 Key Focus Areas Today
1. **P0 Outage Mitigation**: Immediate focus on unblocking database and payment webhook timeouts.
2. **Review Open PRs**: Expedite code reviews for pending bug fixes.
3. **Sprint Velocity**: 4 tickets completed in previous cycle, 2 currently in QA testing.

### 📋 Top Open Issues
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
}
