import { Controller, Post, Get, Patch, Delete, Param, Body, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { IntegrationsService, GitHubIssueSummary } from '../integrations/integrations.service';

@Controller('api/agent')
export class AgentController {

  // Live Dynamic Team Roster (backed by real GitHub collaborators and configurable teammates)
  private liveTeamMembers: Array<{
    id: string;
    name: string;
    role: string;
    githubUsername: string;
    avatarUrl: string;
    email: string;
    maxCapacityPoints: number;
    primaryComponent: string;
  }> = [
    {
      id: 'member-bekizod',
      name: 'bekizod (Repo Owner)',
      role: 'Staff Full Stack AI Tech Lead',
      githubUsername: 'bekizod',
      avatarUrl: 'https://avatars.githubusercontent.com/u/121251335?v=4',
      email: 'bekizodcancer@gmail.com',
      maxCapacityPoints: 25,
      primaryComponent: 'Multi-Agent Architecture & SRE',
    },
  ];

  // Dynamic Issue-to-Member Assignment Map (issueNumber -> memberId)
  private issueAssignments: Record<number, string> = {};

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
        blastRadius: {
          affectedServices: ['iam-service', 'tenant-gateway'],
          blastRadiusScore: 'Medium',
          customerExposurePercentage: 45,
          dataIntegrityRisk: false,
          architecturalComponents: ['Auth Gateway', 'Directory Sync'],
        },
        reliabilityRisk: {
          deploymentRiskScore: 28,
          slaBreachProbability: 'Low (<10%)',
          estimatedMttrHours: 4.0,
          canaryRolloutRecommended: true,
          mitigationRunbook: ['Feature flag gating by tenant ID'],
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

      const isP0 = severity === 'P0';

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
          requiresUrgentMeeting: isP0,
        },
        blastRadius: {
          affectedServices: isP0 ? ['billing-gateway', 'payment-worker', 'tenant-authorizer'] : ['core-service'],
          blastRadiusScore: isP0 ? 'Critical' : 'Medium',
          customerExposurePercentage: isP0 ? 92 : 15,
          dataIntegrityRisk: isP0,
          architecturalComponents: ['PostgreSQL Pool', 'Worker Threads', 'API Gateway'],
        },
        reliabilityRisk: {
          deploymentRiskScore: isP0 ? 88 : 34,
          slaBreachProbability: isP0 ? 'Critical (>75%)' : 'Low (<10%)',
          estimatedMttrHours: isP0 ? 2.0 : 6.0,
          canaryRolloutRecommended: true,
          mitigationRunbook: ['Apply circuit breaker pattern', 'Drain traffic from failing pods'],
        },
        githubIssue: {
          issueNumber: issue.number,
          issueUrl: issue.url,
          live: true,
        },
      };
    }
  }

  // 1. Reactive Endpoint: Multi-Agent Triage Pipeline
  @Post('triage')
  async triageAndAutomate(@Body('input') input: string) {
    if (!input || !input.trim()) {
      return { error: 'Input cannot be empty' };
    }

    this.logger.log(`Processing multi-agent triage: "${input.substring(0, 80)}..."`);

    const existingIssues = await this.integrationsService.getOpenGitHubIssues();
    const multiAgent = await this.aiService.runMultiAgentTriage(input, existingIssues);
    const triage = multiAgent.triage;

    // Create real GitHub issue
    const githubIssue = await this.integrationsService.createGitHubIssue(triage);

    let calendarEvent: any = null;
    let emailStatus: any = null;

    if (triage.requiresUrgentMeeting || triage.severity === 'P0') {
      calendarEvent = await this.integrationsService.scheduleUrgentTriageMeeting(
        triage.suggestedMeetingTopic || triage.title,
        `${triage.summary}\n\nBlast Radius: ${multiAgent.blastRadius.blastRadiusScore} (${multiAgent.blastRadius.customerExposurePercentage}% exposure)\nDeployment Risk: ${multiAgent.reliabilityRisk.deploymentRiskScore}/100`,
      );

      emailStatus = await this.integrationsService.sendEmailNotification(
        `🚨 [P0 Blocker Triaged - ${multiAgent.blastRadius.blastRadiusScore} Blast Radius] ${triage.title}`,
        `A critical P0 issue was triaged and created on GitHub: ${githubIssue.issueUrl}\n\nSummary: ${triage.summary}\n\nAffected Services: ${multiAgent.blastRadius.affectedServices.join(', ')}\nDeployment Risk Score: ${multiAgent.reliabilityRisk.deploymentRiskScore}/100\nEmergency Calendar Sync: ${calendarEvent.startTime}`,
      );
    }

    const record = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'REACTIVE_TRIAGE',
      triage,
      blastRadius: multiAgent.blastRadius,
      reliabilityRisk: multiAgent.reliabilityRisk,
      deduplication: multiAgent.deduplication,
      codeScaffold: multiAgent.codeScaffold,
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


  // 5. AI Developer Implementation Plan & Auto-Comment on GitHub
  @Post('issues/:number/plan')
  async createImplementationPlan(
    @Param('number') issueNumber: string,
    @Body('title') title: string,
    @Body('body') body: string,
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Generating AI Implementation Plan for GitHub Issue #${num}...`);

    const planMarkdown = await this.aiService.generateImplementationPlan(title || `Issue #${num}`, body || '');
    const commentResult = await this.integrationsService.addGitHubComment(num, planMarkdown);

    return {
      success: true,
      issueNumber: num,
      planMarkdown,
      comment: commentResult,
    };
  }

  // 6. Two-Way State Sync: Close / Reopen GitHub Issue
  @Patch('issues/:number/state')
  async updateIssueState(
    @Param('number') issueNumber: string,
    @Body('state') state: 'open' | 'closed',
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Updating GitHub Issue #${num} state to "${state}"...`);

    const result = await this.integrationsService.updateGitHubIssueState(num, state);

    // Update in-memory activityLog if present
    const item = this.activityLog.find((a) => a.githubIssue?.issueNumber === num);
    if (item) {
      item.state = state;
    }

    return {
      success: true,
      issueNumber: num,
      state,
      result,
    };
  }

  // 7. Inbound Incident Webhook Endpoint (External Monitoring Alerts: Sentry, Datadog, CloudWatch)
  @Post('webhook/incident')
  async handleInboundWebhook(@Body() payload: any) {
    this.logger.log(`Inbound webhook received: ${JSON.stringify(payload).substring(0, 120)}...`);

    const source = payload.source || 'External Monitoring Webhook';
    const rawContent = payload.details || payload.message || payload.error || payload.title || JSON.stringify(payload);

    // Step 1: Gemini analyzes and triages the incident
    const triage = await this.aiService.triageBugReport(rawContent);

    // Step 2: Auto-create real GitHub issue
    const githubIssue = await this.integrationsService.createGitHubIssue(triage);

    // Step 3: Emergency escalation if P0
    let calendarEvent: any = null;
    let emailStatus: any = null;

    if (triage.requiresUrgentMeeting || triage.severity === 'P0') {
      calendarEvent = await this.integrationsService.scheduleUrgentTriageMeeting(
        `[Webhook Incident] ${triage.suggestedMeetingTopic || triage.title}`,
        `Triggered via ${source}\n\nDetails:\n${triage.summary}`,
      );

      emailStatus = await this.integrationsService.sendEmailNotification(
        `🚨 [Autonomous Webhook Escalation - P0] ${triage.title}`,
        `An automated incident was ingested via ${source} and triaged as P0.\n\nGitHub Ticket: ${githubIssue.issueUrl}\nEmergency Calendar War Room: ${calendarEvent.startTime}\n\nSummary:\n${triage.summary}`,
      );
    }

    const record = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'WEBHOOK_INCIDENT',
      webhookSource: source,
      triage,
      githubIssue,
      calendarEvent,
      emailStatus,
    };

    this.activityLog.unshift(record);
    return record;
  }


  // 5b. AI Code Fix & Reproduction Test Generator
  @Post('issues/:number/code-fix')
  async generateIssueCodeFix(
    @Param('number') issueNumber: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('postToGitHub') postToGitHub?: boolean,
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Generating AI Code Fix & Test for Issue #${num}...`);

    const scaffold = await this.aiService.generateCodeFixAndTest(title || `Issue #${num}`, body || '');
    let commentResult: any = null;

    if (postToGitHub) {
      const commentBody = `### 🧪 Autonomous AI Code Fix & Test Proposal

#### Reproduction Test (${scaffold.testFramework})
\`\`\`typescript
${scaffold.reproductionTestCode}
\`\`\`

#### Proposed Git Patch
\`\`\`diff
${scaffold.proposedFixDiff}
\`\`\`

**Technical Tradeoffs:**
${scaffold.technicalTradeoffs}

*Proposed automatically by AI Technical Product Manager Agent*`;

      commentResult = await this.integrationsService.addGitHubComment(num, commentBody);
    }

    return {
      success: true,
      issueNumber: num,
      scaffold,
      comment: commentResult,
    };
  }


  // 6. Autonomous GitHub Pull Request Generator
  @Post('issues/:number/pull-request')
  async createIssuePullRequest(
    @Param('number') issueNumber: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('patchContent') patchContent?: string,
    @Body('testScaffold') testScaffold?: string,
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Autonomous PR request received for Issue #${num}...`);

    let finalPatch = patchContent;
    let finalTest = testScaffold;

    if (!finalPatch || !finalTest) {
      const scaffold = await this.aiService.generateCodeFixAndTest(title || `Issue #${num}`, body || '');
      finalPatch = finalPatch || scaffold.proposedFixDiff;
      finalTest = finalTest || scaffold.reproductionTestCode;
    }

    const prResult = await this.integrationsService.createGitHubPullRequest(
      num,
      title || `Fix for Issue #${num}`,
      finalPatch,
      finalTest,
    );

    // Update activity log with PR details
    const existing = this.activityLog.find(
      (a) => a.githubIssue && a.githubIssue.issueNumber === num,
    );
    if (existing) {
      existing.pullRequest = prResult;
    }

    return {
      success: true,
      issueNumber: num,
      pullRequest: prResult,
    };
  }

  // 7. Incident War Room & Blameless Post-Mortem / RCA Generator
  @Post('issues/:number/post-mortem')
  async generateIssuePostMortem(
    @Param('number') issueNumber: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('severity') severity?: string,
    @Body('publishToGitHub') publishToGitHub?: boolean,
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Synthesizing SRE Post-Mortem & RCA for Issue #${num}...`);

    const postMortem = await this.aiService.generatePostMortem(
      title || `Issue #${num}`,
      body || '',
      severity || 'P0',
    );

    let commentResult: any = null;
    if (publishToGitHub) {
      const commentBody = `## 🚨 SRE Blameless Post-Mortem & Root Cause Analysis (RCA)\n\n${postMortem.markdownReport}`;
      commentResult = await this.integrationsService.addGitHubComment(num, commentBody);
    }

    const existing = this.activityLog.find(
      (a) => a.githubIssue && a.githubIssue.issueNumber === num,
    );
    if (existing) {
      existing.postMortem = postMortem;
    }

    return {
      success: true,
      issueNumber: num,
      postMortem,
      comment: commentResult,
    };
  }

  // 8. Sprint Release Notes & Semantic Changelog Engine
  @Post('release-notes')
  async generateSprintReleaseNotes(
    @Body('version') version?: string,
    @Body('publishToGitHub') publishToGitHub?: boolean,
  ) {
    const targetVersion = version || '1.4.0';
    this.logger.log(`Generating sprint release notes for v${targetVersion}...`);

    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const releaseNotes = await this.aiService.generateReleaseNotes(openIssues, targetVersion);

    let gitHubRelease: any = null;
    if (publishToGitHub) {
      gitHubRelease = await this.integrationsService.createGitHubRelease(
        releaseNotes.version,
        releaseNotes.releaseTitle,
        releaseNotes.markdownChangelog,
      );
    }

    return {
      success: true,
      releaseNotes,
      gitHubRelease,
    };
  }

  // 9. Customer Outage Communication & Executive Briefing Dispatcher
  @Post("issues/:number/outage-comms")
  async generateIssueOutageComms(
    @Param("number") issueNumber: string,
    @Body("title") title: string,
    @Body("body") body: string,
    @Body("severity") severity?: string,
    @Body("dispatchEmail") dispatchEmail?: boolean,
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Synthesizing Outage Communications for Issue #${num}...`);

    const communications = await this.aiService.generateOutageCommunications(
      title || `Issue #${num}`,
      body || "",
      severity || "P0",
    );

    let emailResult: any = null;
    if (dispatchEmail) {
      try {
        emailResult = await this.integrationsService.sendEmailNotification(
          `🚨 [EXECUTIVE BRIEFING] ${title || `Issue #${num}`}`,
          communications.executiveBriefing,
        );
      } catch (err) {
        this.logger.error(`Failed to dispatch executive briefing: ${err}`);
      }
    }

    return {
      success: true,
      issueNumber: num,
      communications,
      emailResult,
    };
  }

  // 10. Interactive AI TPM Copilot Chat ("Ask the TPM")
  @Post("copilot/chat")
  async chatWithTpmCopilot(@Body("prompt") prompt: string) {
    this.logger.log(`TPM Copilot Query: "${prompt}"`);
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const p0s = openIssues.filter((i) => (i.labels || []).includes("P0") || (i.title || "").includes("[P0]"));
    const sprintContext = {
      openIssuesCount: openIssues.length,
      p0Count: p0s.length,
      p0Titles: p0s.map((p) => p.title),
      topIssues: openIssues.slice(0, 5).map((i) => ({ number: i.number, title: i.title })),
    };

    const result = await this.aiService.queryTpmCopilot(prompt, sprintContext);
    return {
      success: true,
      ...result,
    };
  }

  // 11. Team Capacity & Dynamic Workload Balancer
  @Get('team/capacity')
  async getTeamCapacity() {
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const collaborators = await this.integrationsService.getRepoCollaborators();

    // Sync all real GitHub collaborators from the repository
    collaborators.forEach((collab) => {
      const existing = this.liveTeamMembers.find(
        (m) => m.githubUsername.toLowerCase() === collab.username.toLowerCase(),
      );
      if (existing) {
        existing.avatarUrl = collab.avatarUrl;
      } else {
        this.liveTeamMembers.push({
          id: 'member-' + collab.username,
          name: '@' + collab.username,
          role: 'Repository Collaborator',
          githubUsername: collab.username,
          avatarUrl: collab.avatarUrl,
          email: collab.username + '@users.noreply.github.com',
          maxCapacityPoints: 20,
          primaryComponent: 'Full Stack Engineering',
        });
      }
    });

    // Assign any unassigned issues to team members
    openIssues.forEach((issue, idx) => {
      if (!this.issueAssignments[issue.number]) {
        const target = this.liveTeamMembers[idx % this.liveTeamMembers.length];
        if (target) {
          this.issueAssignments[issue.number] = target.id;
        }
      }
    });

    // Calculate dynamic story points per member based on REAL assigned issues
    const members = this.liveTeamMembers.map((member) => {
      const assignedIssues = openIssues.filter(
        (issue) => this.issueAssignments[issue.number] === member.id,
      );

      let points = 0;
      assignedIssues.forEach((issue) => {
        const isP0 = (issue.labels || []).includes('P0') || issue.title.includes('[P0]');
        const isP1 = (issue.labels || []).includes('P1') || issue.title.includes('[P1]');
        const isPrd = (issue.labels || []).includes('feature-spec') || issue.title.startsWith('[Feature Spec]');

        if (isP0) points += 8;
        else if (isP1) points += 5;
        else if (isPrd) points += 8;
        else points += 3;
      });

      const capacityPct = Math.round((points / member.maxCapacityPoints) * 100);

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        avatar: member.avatarUrl,
        githubUsername: member.githubUsername,
        email: member.email,
        assignedIssuesCount: assignedIssues.length,
        assignedIssues: assignedIssues.map(i => ({ number: i.number, title: i.title, labels: i.labels })),
        storyPoints: points,
        maxCapacityPoints: member.maxCapacityPoints,
        capacityPercentage: capacityPct,
        isOverloaded: points > member.maxCapacityPoints,
        primaryComponent: member.primaryComponent,
      };
    });

    const totalPoints = members.reduce((sum, m) => sum + m.storyPoints, 0);
    const totalMax = members.reduce((sum, m) => sum + m.maxCapacityPoints, 0);
    const teamUtilizationPercentage = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;

    // Generate dynamic rebalance recommendations based on actual overloads
    const rebalanceRecommendations: string[] = [];
    const overloadedMembers = members.filter(m => m.isOverloaded);
    const underloadedMembers = members.filter(m => m.capacityPercentage < 75);

    if (overloadedMembers.length > 0) {
      overloadedMembers.forEach(over => {
        const spare = underloadedMembers[0];
        const heavyIssue = over.assignedIssues[0];
        if (spare && heavyIssue) {
          rebalanceRecommendations.push(
            `🚨 ${over.name} is overloaded at ${over.capacityPercentage}% capacity (${over.storyPoints}/${over.maxCapacityPoints} pts). Recommendation: Reassign Issue #${heavyIssue.number} to ${spare.name} (${spare.capacityPercentage}% utilized).`,
          );
        } else {
          rebalanceRecommendations.push(
            `🚨 ${over.name} is overloaded at ${over.capacityPercentage}% capacity (${over.storyPoints}/${over.maxCapacityPoints} pts). Offload secondary bug investigations.`,
          );
        }
      });
    } else {
      rebalanceRecommendations.push(
        `✅ Team workload is healthy across all ${members.length} engineers. Total sprint utilization: ${teamUtilizationPercentage}%.`,
      );
    }

    return {
      success: true,
      capacityPlan: {
        totalSprintPoints: totalPoints,
        teamUtilizationPercentage,
        members,
        rebalanceRecommendations,
      },
      collaborators,
    };
  }

  // 11b. Team Member Management: Add Real Person
  @Post('team/members')
  addTeamMember(
    @Body('name') name: string,
    @Body('role') role: string,
    @Body('githubUsername') githubUsername: string,
    @Body('email') email: string,
    @Body('maxCapacityPoints') maxCapacityPoints?: number,
    @Body('primaryComponent') primaryComponent?: string,
  ) {
    const newMember = {
      id: `member-${Date.now()}`,
      name: name || 'New Team Member',
      role: role || 'Software Engineer',
      githubUsername: githubUsername || '',
      avatarUrl: githubUsername
        ? `https://github.com/${githubUsername}.png`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'Member')}`,
      email: email || '',
      maxCapacityPoints: maxCapacityPoints || 15,
      primaryComponent: primaryComponent || 'Core Services',
    };

    this.liveTeamMembers.push(newMember);
    this.logger.log(`Added live team member: ${newMember.name} (${newMember.role})`);
    return { success: true, member: newMember, totalMembers: this.liveTeamMembers.length };
  }

  // 11c. Team Member Management: Remove Member
  @Delete('team/members/:id')
  removeTeamMember(@Param('id') memberId: string) {
    this.liveTeamMembers = this.liveTeamMembers.filter(m => m.id !== memberId);
    return { success: true, totalMembers: this.liveTeamMembers.length };
  }

  // 11d. Assign Issue to Real Team Member (with optional GitHub Assignee Sync)
  @Post('issues/:number/assign')
  async assignIssueToMember(
    @Param('number') issueNumber: string,
    @Body('memberId') memberId: string,
    @Body('syncToGitHub') syncToGitHub?: boolean,
  ) {
    const num = parseInt(issueNumber, 10);
    this.issueAssignments[num] = memberId;
    const member = this.liveTeamMembers.find(m => m.id === memberId);

    let gitHubSyncResult: any = null;
    if (syncToGitHub && member?.githubUsername) {
      gitHubSyncResult = await this.integrationsService.assignGitHubIssue(num, [member.githubUsername]);
    }

    // Dispatch real email notification to assignee
    let emailResult: any = null;
    if (member) {
      const openIssues = await this.integrationsService.getOpenGitHubIssues();
      const issue = openIssues.find(i => i.number === num);
      const issueTitle = issue?.title || `Issue #${num}`;
      const repoOwner = this.integrationsService.getRepoOwner();
      const repoName = this.integrationsService.getRepoName();
      const issueUrl = `https://github.com/${repoOwner}/${repoName}/issues/${num}`;
      const toEmail = member.email || process.env.NOTIFICATION_EMAIL_TO || 'bekizodcancer@gmail.com';

      const emailSubject = `[TPM Task Assigned] #${num}: ${issueTitle}`;
      const emailBody = `### Task Assignment Notification\n\n` +
        `Hello **${member.name}**,\n\n` +
        `You have been assigned to GitHub Issue **#${num}**: **${issueTitle}** in sprint planning.\n\n` +
        `- **Repository**: \`${repoOwner}/${repoName}\`\n` +
        `- **Assigned Engineer**: ${member.name} (${member.role})\n` +
        `- **Focus Area**: ${member.primaryComponent || 'General Engineering'}\n` +
        `- **GitHub Link**: [View Issue #${num} on GitHub](${issueUrl})\n\n` +
        `Please review this issue and verify acceptance criteria in your TPM dashboard.`;

      try {
        emailResult = await this.integrationsService.sendEmailNotification(
          emailSubject,
          emailBody,
          toEmail,
        );
      } catch (err) {
        this.logger.warn(`Failed to dispatch assignment email to ${toEmail}: ${err}`);
      }
    }

    return {
      success: true,
      issueNumber: num,
      assignedTo: member,
      gitHubSyncResult,
      emailResult,
    };
  }

  // 11e. Autonomous Workload Rebalancer: Auto-reassign issues to level out capacity
  @Post('team/rebalance')
  async autoRebalanceWorkload() {
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const capacityRes = await this.getTeamCapacity();
    const members = capacityRes.capacityPlan.members;

    const overloaded = members.filter(m => m.isOverloaded);
    const underloaded = members.filter(m => m.capacityPercentage < 80);

    let rebalancedCount = 0;
    for (const over of overloaded) {
      if (over.assignedIssues.length > 1) {
        const issueToMove = over.assignedIssues[over.assignedIssues.length - 1];
        const target = underloaded.find(u => u.id !== over.id);
        if (target && issueToMove) {
          this.issueAssignments[issueToMove.number] = target.id;
          rebalancedCount++;
        }
      }
    }

    return {
      success: true,
      rebalancedCount,
      updatedCapacity: await this.getTeamCapacity(),
    };
  }

  // 12. Security, PII & SOC2 Compliance Audit Engine
  @Post("issues/:number/compliance-audit")
  async runIssueComplianceAudit(
    @Param("number") issueNumber: string,
    @Body("title") title: string,
    @Body("body") body: string,
  ) {
    const num = parseInt(issueNumber, 10);
    this.logger.log(`Running Security & SOC2 Compliance Audit on Issue #${num}...`);
    const report = await this.aiService.auditSecurityAndCompliance(title || `Issue #${num}`, body || "");
    return {
      success: true,
      issueNumber: num,
      report,
    };
  }

  // 8. Engineering Sprint Health & Velocity Analytics Endpoint
  @Get('analytics')
  async getSprintAnalytics() {
    const openIssues = await this.integrationsService.getOpenGitHubIssues();
    const total = openIssues.length;
    const p0s = openIssues.filter((i) => (i.labels || []).includes('P0') || (i.title || '').includes('[P0]')).length;
    const p1s = openIssues.filter((i) => (i.labels || []).includes('P1') || (i.title || '').includes('[P1]')).length;
    const prds = openIssues.filter((i) => (i.labels || []).includes('feature-spec') || (i.title || '').startsWith('[Feature Spec]')).length;
    const closed = this.activityLog.filter((a) => a.state === 'closed').length;

    const components = [
      { name: 'Billing Gateway (Stripe)', activeIssues: p0s > 0 ? 1 : 0, riskScore: 92, riskLevel: 'Critical', mttr: '1.8 hrs' },
      { name: 'Worker Queue (Report Generation)', activeIssues: openIssues.some(i => i.title.toLowerCase().includes('heap') || i.title.toLowerCase().includes('worker')) ? 1 : 0, riskScore: 84, riskLevel: 'High', mttr: '3.2 hrs' },
      { name: 'PostgreSQL Connection Pool', activeIssues: openIssues.some(i => i.title.toLowerCase().includes('pool') || i.title.toLowerCase().includes('database')) ? 1 : 0, riskScore: 68, riskLevel: 'Medium', mttr: '4.5 hrs' },
      { name: 'Enterprise IAM (SAML/Okta)', activeIssues: prds > 0 ? 1 : 0, riskScore: 24, riskLevel: 'Low', mttr: 'N/A (Feature)' },
      { name: 'Webhook Event Broker', activeIssues: openIssues.some(i => i.title.toLowerCase().includes('replay')) ? 1 : 0, riskScore: 32, riskLevel: 'Low', mttr: 'N/A (Feature)' },
    ];

    const burndown = [
      { day: 'Mon', ideal: 12, actual: 12 },
      { day: 'Tue', ideal: 10, actual: 11 },
      { day: 'Wed', ideal: 8, actual: 9 },
      { day: 'Thu', ideal: 6, actual: 7 },
      { day: 'Fri', ideal: 4, actual: Math.max(2, total) },
      { day: 'Sat', ideal: 2, actual: Math.max(1, total - 1) },
      { day: 'Sun (Target)', ideal: 0, actual: Math.max(0, total - 2) },
    ];

    return {
      kpis: {
        mttdMinutes: 1.8,
        mttrHours: 3.4,
        slaComplianceRate: 94.2,
        criticalDefectRatio: total > 0 ? Math.round(((p0s + p1s) / total) * 100) : 0,
        totalTracked: total,
        p0Count: p0s,
        p1Count: p1s,
        prdCount: prds,
        resolvedCount: closed,
      },
      components,
      burndown,
    };
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
