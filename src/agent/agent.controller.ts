import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { IntegrationsService, GitHubIssueSummary } from '../integrations/integrations.service';

@Controller('api/agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  // In-memory activity log
  private activityLog: any[] = [];

  constructor(
    private readonly aiService: AiService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  // Helper to map real GitHub issues into rich activity items
  private parseIssueToActivity(issue: GitHubIssueSummary): any {
    const isPrd =
      issue.title.startsWith('[Feature Spec]') ||
      issue.labels.some((l) => l.toLowerCase() === 'feature-spec');
    const labels = issue.labels || [];
    const body = issue.body || '';

    if (isPrd) {
      const title = issue.title.replace(/^\[Feature Spec\]\s*/i, '');
      const probMatch = body.match(/### 🎯 Problem Statement\s*\n([\s\S]*?)(?=\n###|\n---|$)/i);
      const audMatch = body.match(/### 👥 Target Audience\s*\n([\s\S]*?)(?=\n###|\n---|$)/i);
      const effMatch = body.match(/### ⏱️ Estimated Effort\s*\n\**([\s\S]*?)\**(?=\n###|\n---|$)/i);
      const archMatch = body.match(/### 🏗️ Technical Architecture[\s\S]*?\n([\s\S]*?)(?=\n###|\n---|$)/i);

      return {
        id: issue.number * 1000,
        timestamp: issue.createdAt,
        type: 'FEATURE_PRD',
        prd: {
          title,
          targetAudience: audMatch ? audMatch[1].trim() : 'Enterprise IT & Developers',
          problemStatement: probMatch ? probMatch[1].trim() : body.slice(0, 300) || title,
          userStories: [
            {
              asA: 'Product User',
              iWant: title,
              soThat: 'our team can scale safely and efficiently.',
              acceptanceCriteria: [
                'Feature functions in compliance with specification.',
                'Integration tests added to CI/CD pipeline.',
              ],
            },
          ],
          technicalArchitecture: archMatch ? archMatch[1].trim() : 'Cloud native distributed microservices architecture.',
          nonFunctionalRequirements: ['High availability 99.95% SLA', 'SOC2 Type II encryption at rest & in transit'],
          successMetrics: ['Adoption rate > 80% among target accounts', 'Zero critical security defects'],
          estimatedEffort: effMatch ? effMatch[1].replace(/\*/g, '').trim() : 'Medium (1 week)',
          recommendedLabels: labels,
          markdownPrd: body,
        },
        githubIssue: {
          issueNumber: issue.number,
          issueUrl: issue.url,
          live: true,
        },
      };
    } else {
      const sevMatch = issue.title.match(/\[(P[0-3])\]/i) || labels.find((l) => /^P[0-3]$/i.test(l));
      const severity = (Array.isArray(sevMatch) ? sevMatch[1] : sevMatch || 'P2').toUpperCase();
      const title = issue.title.replace(/^\[P[0-3]\]\s*/i, '');
      const sumMatch = body.match(/### Summary\s*\n([\s\S]*?)(?=\n###|\n---|$)/i);
      const stepsMatch = body.match(/### Steps to Reproduce\s*\n([\s\S]*?)(?=\n###|\n---|$)/i);
      const critMatch = body.match(/### Acceptance Criteria\s*\n([\s\S]*?)(?=\n###|\n---|$)/i);

      const reproductionSteps = stepsMatch
        ? stepsMatch[1].split('\n').map((s) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
        : ['Log into system dashboard.', 'Reproduce action and inspect telemetry.'];

      const acceptanceCriteria = critMatch
        ? critMatch[1].split('\n').map((c) => c.replace(/^-\s*\[\s*\]\s*/, '').trim()).filter(Boolean)
        : ['Fix root cause and add regression integration test.'];

      return {
        id: issue.number * 1000,
        timestamp: issue.createdAt,
        type: 'REACTIVE_TRIAGE',
        triage: {
          title,
          summary: sumMatch ? sumMatch[1].trim() : body.slice(0, 300) || title,
          severity,
          reproductionSteps,
          acceptanceCriteria,
          labels,
          requiresUrgentMeeting: severity === 'P0',
        },
        githubIssue: {
          issueNumber: issue.number,
          issueUrl: issue.url,
          live: true,
        },
      };
    }
  }

  // 1. Reactive Endpoint: User submits raw bug report or command via UI
  @Post('triage')
  async triageAndAutomate(@Body('input') input: string) {
    if (!input || !input.trim()) {
      return { error: 'Input cannot be empty' };
    }

    this.logger.log(`Processing bug triage: "${input.substring(0, 80)}..."`);

    const triage = await this.aiService.triageBugReport(input);
    const githubIssue = await this.integrationsService.createGitHubIssue(triage);

    let calendarEvent: any = null;
    let emailStatus: any = null;

    if (triage.requiresUrgentMeeting || triage.severity === 'P0') {
      calendarEvent = await this.integrationsService.scheduleUrgentTriageMeeting(
        triage.suggestedMeetingTopic || triage.title,
        triage.summary,
      );

      emailStatus = await this.integrationsService.sendEmailNotification(
        `🚨 [P0 Blocker Triaged] ${triage.title}`,
        `A critical P0 issue was triaged and created on GitHub: ${githubIssue.issueUrl}\n\nSummary: ${triage.summary}\nEmergency Calendar Sync scheduled for: ${calendarEvent.startTime}`,
      );
    }

    const record = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'REACTIVE_TRIAGE',
      triage,
      githubIssue,
      calendarEvent,
      emailStatus,
    };

    this.activityLog.unshift(record);
    return record;
  }

  // 1b. PRD Specification Endpoint: User submits raw feature idea or enterprise request
  @Post('prd')
  async generateFeaturePrd(@Body('input') input: string) {
    if (!input || !input.trim()) {
      return { error: 'Feature input cannot be empty' };
    }

    this.logger.log(`Generating Feature PRD: "${input.substring(0, 80)}..."`);

    const prd = await this.aiService.generatePrd(input);
    const githubIssue = await this.integrationsService.createGitHubPrd(prd);

    const record = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'FEATURE_PRD',
      prd,
      githubIssue,
    };

    this.activityLog.unshift(record);
    return record;
  }

  // 2. Proactive Endpoint: Triggered daily by GCP Cloud Scheduler
  @Post('cron/daily-digest')
  async triggerDailySprintDigest() {
    this.logger.log('Triggering proactive sprint digest cron job with real repository issues...');
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const digest = await this.aiService.generateDailySprintDigest(openIssues);

    const emailStatus = await this.integrationsService.sendEmailNotification(
      `📊 Daily AI Technical PM Sprint Standup Digest (${new Date().toLocaleDateString()})`,
      digest,
    );

    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'PROACTIVE_DIGEST',
      openIssuesCount: openIssues.length,
      digest,
      emailStatus,
    };

    this.activityLog.unshift(logEntry);
    return logEntry;
  }

  // 3. Dashboard State Endpoint: Ingests all real repository issues seamlessly
  @Get('status')
  async getDashboardStatus() {
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const configStatus = this.integrationsService.getIntegrationStatus();

    // Sync any GitHub issues not yet in activityLog
    const existingIssueNumbers = new Set(
      this.activityLog
        .filter((a) => a.githubIssue && a.githubIssue.issueNumber)
        .map((a) => a.githubIssue.issueNumber),
    );

    for (const issue of openIssues) {
      if (!existingIssueNumbers.has(issue.number)) {
        this.activityLog.push(this.parseIssueToActivity(issue));
        existingIssueNumbers.add(issue.number);
      }
    }

    // Sort newest first
    this.activityLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      openIssues,
      activityLog: this.activityLog,
      configStatus,
    };
  }

  // 4. Integrations Health Endpoint
  @Get('config')
  getConfig() {
    return this.integrationsService.getIntegrationStatus();
  }
}
