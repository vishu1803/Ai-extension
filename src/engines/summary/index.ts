import { ChatMessage } from '../../adapters/engineTypes';
import { StructuredSummary, defaultSummary } from './types';

export class SummaryEngine {
  private summary: StructuredSummary;
  private processedMessageIds: Set<string>;

  constructor(initialSummary?: StructuredSummary) {
    this.summary = initialSummary ? { ...initialSummary } : { ...defaultSummary };
    this.processedMessageIds = new Set();
  }

  public getSummary(): StructuredSummary {
    return this.summary;
  }

  /**
   * Incrementally updates the summary using only new messages to avoid 
   * reprocessing the entire conversation history every time.
   */
  public processIncremental(messages: ChatMessage[]): StructuredSummary {
    const newMessages = messages.filter(m => !this.processedMessageIds.has(m.id));
    
    if (newMessages.length === 0) {
      return this.summary; // Nothing to update
    }

    for (const msg of newMessages) {
      this.extractHeuristics(msg);
      this.processedMessageIds.add(msg.id);
    }
    
    // Update the current discussion topic based on the last few messages
    this.updateCurrentDiscussion(messages);

    return this.summary;
  }

  private extractHeuristics(msg: ChatMessage) {
    const text = msg.text;
    const lowerText = text.toLowerCase();

    // 1. Links
    const linkRegex = /https?:\/\/[^\s)]+/g;
    const links = text.match(linkRegex);
    if (links) {
      this.summary.links = [...new Set([...this.summary.links, ...links])];
    }

    // 2. Code Generated & Files
    if (text.includes('```')) {
      this.summary.codeGenerated = true;
      
      // Look for file paths often mentioned before code blocks or in markdown links
      const fileRegex = /([a-zA-Z0-9_\-\/]+\.(ts|js|tsx|jsx|css|html|md|py|go|rs|json))/g;
      const files = text.match(fileRegex);
      if (files) {
        this.summary.filesCreated = [...new Set([...this.summary.filesCreated, ...files])];
      }
    }

    // 3. Tasks
    const pendingTasks = [...text.matchAll(/- \[ \] (.*)/g)].map(m => m[1]);
    if (pendingTasks.length > 0) {
      this.summary.pendingTasks = [...new Set([...this.summary.pendingTasks, ...pendingTasks])];
    }
    
    const completedTasks = [...text.matchAll(/- \[x\] (.*)/g)].map(m => m[1]);
    if (completedTasks.length > 0) {
      this.summary.completedTasks = [...new Set([...this.summary.completedTasks, ...completedTasks])];
      // Remove completed from pending
      this.summary.pendingTasks = this.summary.pendingTasks.filter(t => !completedTasks.includes(t));
    }

    // 4. Bugs
    if (lowerText.includes('error:') || lowerText.includes('exception') || lowerText.includes('bug')) {
      // Basic heuristic: grab the sentence with the word 'error'
      const sentences = text.split(/[.!?\n]/);
      for (const s of sentences) {
        if (s.toLowerCase().includes('error') && s.length > 10) {
          this.summary.bugs.push(s.trim());
        }
      }
      this.summary.bugs = [...new Set(this.summary.bugs)];
    }

    // 5. Architecture Decisions
    if (msg.role === 'user' && (lowerText.includes('use zustand') || lowerText.includes('architecture') || lowerText.includes('we will use'))) {
      const sentences = text.split(/[.!?\n]/);
      for (const s of sentences) {
        if ((s.toLowerCase().includes('use') || s.toLowerCase().includes('architecture')) && s.length > 10) {
          this.summary.architectureDecisions.push(s.trim());
        }
      }
    }

    // 6. Project Goal (Usually set in the first user message)
    if (msg.role === 'user' && !this.summary.projectGoal) {
      if (lowerText.includes('build a') || lowerText.includes('create a') || lowerText.includes('implement')) {
        this.summary.projectGoal = text.split('\n')[0].substring(0, 100);
      }
    }

    // 7. APIs
    const apiRegex = /([A-Z][a-zA-Z0-9_]+API|fetch\(|axios\.|chrome\.[a-zA-Z]+)/g;
    const apis = text.match(apiRegex);
    if (apis) {
      this.summary.apis = [...new Set([...this.summary.apis, ...apis.map(a => a.replace(/\(/g, ''))])];
    }

    // 8. User Preferences
    if (msg.role === 'user' && (lowerText.includes('prefer') || lowerText.includes('don\'t use') || lowerText.includes('always'))) {
      const sentences = text.split(/[.!?\n]/);
      for (const s of sentences) {
        if ((s.toLowerCase().includes('prefer') || s.toLowerCase().includes('always')) && s.length > 5) {
          this.summary.userPreferences.push(s.trim());
        }
      }
      this.summary.userPreferences = [...new Set(this.summary.userPreferences)];
    }
    
    // 9. Facts (General technical statements by AI)
    if (msg.role === 'assistant' && (lowerText.includes('fact:') || text.includes('Note:'))) {
      const sentences = text.split(/[.!?\n]/);
      for (const s of sentences) {
        if ((s.includes('fact:') || s.includes('Note:')) && s.length > 10) {
          this.summary.facts.push(s.replace(/fact:|Note:/i, '').trim());
        }
      }
    }
  }

  private updateCurrentDiscussion(messages: ChatMessage[]) {
    // Take the last 2 messages to figure out current discussion context
    const recentMessages = messages.slice(-2);
    if (recentMessages.length > 0) {
      const lastMsg = recentMessages[recentMessages.length - 1];
      // Take first sentence of the last message as current discussion topic
      this.summary.currentDiscussion = lastMsg.text.split(/[.!?\n]/)[0].substring(0, 80) + '...';
    }
  }
}
