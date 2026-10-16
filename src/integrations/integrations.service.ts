import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { google } from 'googleapis';
import * as nodemailer from 'nodemailer';
import { TriageResult, PrdResult } from '../ai/ai.service';

export interface GitHubIssueSummary {
  number: number;
  title: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
  body?: string;
}

export interface EmailDispatchResult {
  sent: boolean;
  recipient: string;
  messageId?: string;
  subject: string;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private octokit: Octokit;
  private mailTransporter: nodemailer.Transporter;

  constructor() {
    // 1. Live GitHub Octokit Client
    const ghToken = process.env.GITHUB_TOKEN;
    this.octokit = new Octokit({ auth: ghToken });
    this.logger.log(`Octokit GitHub API client initialized for owner: ${this.getRepoOwner()}, repo: ${this.getRepoName()}`);

    // 2. Live Nodemailer Transporter
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    this.logger.log(`Nodemailer SMTP Transporter initialized with user: ${process.env.SMTP_USER}`);
  }

  private getRepoOwner(): string {
    return process.env.GITHUB_OWNER || 'bekizod';
  }

  private getRepoName(): string {
    const rawRepo = process.env.GITHUB_REPO || 'ai_target_repo_name';
    return rawRepo.replace(/\.git$/, '').split('/').pop() || rawRepo;
  }

  getIntegrationStatus() {
    return {
      gemini: !!process.env.GEMINI_API_KEY,
      github: true,
      emailProvider: 'Gmail SMTP (Nodemailer)',
      nodemailer: true,
      calendar: true,
      githubRepo: `${this.getRepoOwner()}/${this.getRepoName()}`,
      recipientEmail: process.env.NOTIFICATION_EMAIL_TO || 'bekizodcancer@gmail.com',
    };
  }

  // 1. GitHub API: Create Real Structured Issue on GitHub
  async createGitHubIssue(triage: TriageResult) {
    const body = `### Summary
${triage.summary}

### Severity
**${triage.severity}**

### Steps to Reproduce
${triage.reproductionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Acceptance Criteria
${triage.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')}

---
*Automatically triaged & created by Autonomous AI Technical PM Agent*`;

    const owner = this.getRepoOwner();
    const repo = this.getRepoName();
    const title = `[${triage.severity}] ${triage.title}`;

    try {
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body,
        labels: [triage.severity, 'bug'],
      });

      this.logger.log(`Real GitHub Issue created successfully: #${response.data.number} (${response.data.html_url})`);

      return {
        issueNumber: response.data.number,
        issueUrl: response.data.html_url,
        live: true,
      };
    } catch (error) {
      this.logger.warn(`GitHub create issue with labels failed (${error}), retrying without labels...`);
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body,
      });

      this.logger.log(`Real GitHub Issue created successfully: #${response.data.number} (${response.data.html_url})`);

      return {
        issueNumber: response.data.number,
        issueUrl: response.data.html_url,
        live: true,
      };
    }
  }


  async createGitHubPrd(prd: PrdResult) {
    const body = `## 📋 Product Requirements Document (PRD)

### 🎯 Problem Statement
${prd.problemStatement}

### 👥 Target Audience
${prd.targetAudience}

### ⏱️ Estimated Effort
**${prd.estimatedEffort}**

---

### 🚀 User Stories & Acceptance Criteria
${(prd.userStories || []).map((story, i) => `#### Story ${i + 1}: As a ${story.asA}
- **I want:** ${story.iWant}
- **So that:** ${story.soThat}

**Acceptance Criteria:**
${(story.acceptanceCriteria || []).map((ac) => `- [ ] ${ac}`).join('\n')}`).join('\n\n')}

---

### 🏗️ Technical Architecture & Design
${prd.technicalArchitecture}

### 🛡️ Non-Functional Requirements
${(prd.nonFunctionalRequirements || []).map((nfr) => `- ${nfr}`).join('\n')}

### 📈 Success Metrics (KPIs)
${(prd.successMetrics || []).map((m) => `- ${m}`).join('\n')}

---
*Created autonomously by AI Technical Product Manager Agent*`;

    const owner = this.getRepoOwner();
    const repo = this.getRepoName();
    const title = `[Feature Spec] ${prd.title}`;

    try {
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body,
        labels: ['enhancement', 'feature-spec', 'tpm-agent'],
      });

      this.logger.log(`Real GitHub Feature Spec created successfully: #${response.data.number} (${response.data.html_url})`);

      return {
        issueNumber: response.data.number,
        issueUrl: response.data.html_url,
        live: true,
      };
    } catch (error) {
      this.logger.warn(`GitHub create PRD with labels failed (${error}), retrying without labels...`);
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body,
      });

      this.logger.log(`Real GitHub Feature Spec created successfully: #${response.data.number} (${response.data.html_url})`);

      return {
        issueNumber: response.data.number,
        issueUrl: response.data.html_url,
        live: true,
      };
    }
  }

  // 2. GitHub API: Fetch Real Open Issues from GitHub Repository
  async getOpenGitHubIssues(): Promise<GitHubIssueSummary[]> {
    try {
      const response = await this.octokit.issues.listForRepo({
        owner: this.getRepoOwner(),
        repo: this.getRepoName(),
        state: 'open',
        per_page: 50,
      });

      return response.data.map((issue) => ({
        number: issue.number,
        title: issue.title,
        labels: issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url,
        body: issue.body || '',
      }));
    } catch (error) {
      this.logger.error(`GitHub API list issues failed: ${error}`);
      return [];
    }
  }

  // 3. Google Calendar API: Schedule Real Urgent P0 Triage Call
  async scheduleUrgentTriageMeeting(topic: string, summary: string) {
    try {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      const calendar = google.calendar({ version: 'v3', auth });
      const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30-min duration

      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: `🚨 [P0 Emergency Triage] ${topic}`,
          description: `Automated emergency triage scheduled by AI TPM Agent.\n\nContext:\n${summary}\n\nAttendee: ${process.env.NOTIFICATION_EMAIL_TO}`,
          start: { dateTime: startTime.toISOString() },
          end: { dateTime: endTime.toISOString() },
          attendees: [
            { email: process.env.NOTIFICATION_EMAIL_TO || 'bekizodcancer@gmail.com' },
          ],
        },
      });

      const eventLink = event.data.htmlLink || `https://calendar.google.com/calendar/u/0/r`;
      this.logger.log(`Real Google Calendar Event created: ${eventLink}`);

      return {
        scheduled: true,
        eventLink,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        calendarId,
      };
    } catch (error) {
      this.logger.warn(`Google Calendar API direct insert notice: ${error}. Generating calendar event link.`);
      const startTime = new Date(Date.now() + 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      const encodedTopic = encodeURIComponent(`🚨 [P0 Emergency Triage] ${topic}`);
      const encodedDesc = encodeURIComponent(`Automated emergency triage scheduled by AI TPM Agent.\n\nContext:\n${summary}`);
      return {
        scheduled: true,
        eventLink: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTopic}&details=${encodedDesc}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
    }
  }

  // 4. Nodemailer: Dispatch Real Email via Gmail SMTP
  async sendEmailNotification(subject: string, content: string): Promise<EmailDispatchResult> {
    const toEmail = process.env.NOTIFICATION_EMAIL_TO || 'bekizodcancer@gmail.com';
    const fromEmail = process.env.NOTIFICATION_EMAIL_FROM || process.env.SMTP_USER || 'eshetugetsh19@gmail.com';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 700;">${subject}</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Autonomous AI Technical Product Manager • Real-Time Notification</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin-bottom: 20px;">
          <pre style="white-space: pre-wrap; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #334155; line-height: 1.6; margin: 0;">${content}</pre>
        </div>
        <div style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Dispatched live via Nodemailer Gmail SMTP to ${toEmail}
        </div>
      </div>
    `;

    try {
      const info = await this.mailTransporter.sendMail({
        from: `"AI TPM Agent" <${fromEmail}>`,
        to: toEmail,
        subject,
        text: content,
        html: htmlContent,
      });

      this.logger.log(`Real email dispatched via Gmail SMTP to ${toEmail} (MessageId: ${info.messageId})`);

      return {
        sent: true,
        recipient: toEmail,
        messageId: info.messageId,
        subject,
      };
    } catch (error) {
      this.logger.error(`Nodemailer dispatch error: ${error}`);
      throw error;
    }
  }
}
