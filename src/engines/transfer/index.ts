import { StructuredSummary } from '../summary/types';
import { TransferOptions, TransferResult } from './types';

export class TransferEngine {
  public static generateExport(summary: StructuredSummary | null, options: TransferOptions): TransferResult {
    if (!summary) {
      return { content: 'No conversation context available.', mimeType: 'text/plain', extension: '.txt' };
    }

    if (options.format === 'json') {
      return {
        content: JSON.stringify(this.buildContextObject(summary, options), null, 2),
        mimeType: 'application/json',
        extension: '.json'
      };
    }

    const content = options.format === 'markdown' 
      ? this.generateMarkdown(summary, options)
      : this.generatePlainText(summary, options);

    return {
      content,
      mimeType: options.format === 'markdown' ? 'text/markdown' : 'text/plain',
      extension: options.format === 'markdown' ? '.md' : '.txt'
    };
  }

  private static buildContextObject(summary: StructuredSummary, options: TransferOptions) {
    const data: any = {
      context: 'Transferred from AI Context Tracker'
    };

    if (options.includeMemory) {
      data.projectGoal = summary.projectGoal;
      data.facts = summary.facts;
      data.architecture = summary.architectureDecisions;
      data.preferences = summary.userPreferences;
    }

    if (options.includeCompleted) {
      data.completedTasks = summary.completedTasks;
      data.filesCreated = summary.filesCreated;
    }

    if (options.includePending) {
      data.pendingTasks = summary.pendingTasks;
      data.bugs = summary.bugs;
    }

    if (options.nextPrompt) {
      data.nextPrompt = options.nextPrompt;
    }

    return data;
  }

  private static generateMarkdown(summary: StructuredSummary, options: TransferOptions): string {
    let md = '';

    // LLM-specific preamble
    if (options.target === 'claude') {
      md += `<system_instructions>\nYou are picking up a transferred conversation. Read the context below carefully.\n</system_instructions>\n\n`;
    } else if (options.target === 'chatgpt') {
      md += `**System Context:** We are continuing a previous conversation. Here is our exact state:\n\n`;
    } else if (options.target === 'gemini') {
      md += `[Conversation Transfer Protocol Initiated]\n\n`;
    }

    md += `# Project Context\n\n`;

    if (options.includeMemory) {
      if (summary.projectGoal) md += `**Goal:** ${summary.projectGoal}\n\n`;
      
      if (summary.facts.length > 0) {
        md += `## Established Facts\n`;
        summary.facts.forEach(f => md += `- ${f}\n`);
        md += '\n';
      }

      if (summary.architectureDecisions.length > 0) {
        md += `## Architecture Decisions\n`;
        summary.architectureDecisions.forEach(a => md += `- ${a}\n`);
        md += '\n';
      }

      if (summary.userPreferences.length > 0) {
        md += `## User Preferences\n`;
        summary.userPreferences.forEach(p => md += `- ${p}\n`);
        md += '\n';
      }
    }

    if (options.includeCompleted) {
      md += `## Completed Work\n`;
      if (summary.completedTasks.length > 0) {
        summary.completedTasks.forEach(t => md += `- [x] ${t}\n`);
      } else {
        md += `*(None formally recorded)*\n`;
      }
      
      if (summary.filesCreated.length > 0) {
        md += `\n**Files Created:**\n`;
        summary.filesCreated.forEach(f => md += `- \`${f}\`\n`);
      }
      md += '\n';
    }

    if (options.includePending) {
      md += `## Pending Work & Known Issues\n`;
      if (summary.pendingTasks.length > 0) {
        summary.pendingTasks.forEach(t => md += `- [ ] ${t}\n`);
      }
      if (summary.bugs.length > 0) {
        summary.bugs.forEach(b => md += `- 🐛 **BUG:** ${b}\n`);
      }
      md += '\n';
    }

    if (options.nextPrompt) {
      md += `---\n\n## Next Prompt\n\n${options.nextPrompt}\n`;
    }

    return md;
  }

  private static generatePlainText(summary: StructuredSummary, options: TransferOptions): string {
    // Strip markdown formatting for plain text
    return this.generateMarkdown(summary, options)
      .replace(/#/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '');
  }
}
