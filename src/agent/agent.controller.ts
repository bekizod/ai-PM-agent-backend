import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { IntegrationsService } from '../integrations/integrations.service';

@Controller('api/agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  // Pure real activity log, initially empty
  private activityLog: any[] = [];

  constructor(
    private readonly aiService: AiService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  // 1. Reactive Endpoint: User submits raw bug report or command via UI
  @Post('triage')
  async triageAndAutomate(@Body('input') input: string) {
    if (!input || !input.trim()) {
      return { error: 'Input cannot be empty' };
    }

    this.logger.log(`Processing bug triage: "${input.substring(0, 80)}..."`);

    // Step 1: Gemini analyzes and structures the raw input
    const triage = await this.aiService.triageBugReport(input);

    // Step 2: Create real GitHub Issue automatically
    const githubIssue = await this.integrationsService.createGitHubIssue(triage);

    // Step 3: If P0 / Urgent, automatically book Google Calendar triage meeting & alert team
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

    // Step 1: Gemini structures comprehensive PRD
    const prd = await this.aiService.generatePrd(input);

    // Step 2: Create real GitHub Feature Spec Issue
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

  // 3. Dashboard State Endpoint
  @Get('status')
  async getDashboardStatus() {
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const configStatus = this.integrationsService.getIntegrationStatus();
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
