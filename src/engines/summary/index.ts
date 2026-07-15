import { ChatMessage } from '../../adapters/engineTypes';
import { StructuredSummary, defaultSummary } from './types';
import { ExtractiveSummarizer } from './extractive';

export class SummaryEngine {
  private summary: StructuredSummary;
  private processedMessageIds: Set<string>;
  private summarizer: ExtractiveSummarizer;

  constructor(initialSummary?: StructuredSummary) {
    this.summary = initialSummary ? { ...initialSummary } : { ...defaultSummary };
    this.processedMessageIds = new Set();
    this.summarizer = new ExtractiveSummarizer();
  }

  public getSummary(): StructuredSummary {
    return this.summary;
  }

  /**
   * Incrementally updates the summary using only new messages to avoid
   * reprocessing the entire conversation history every time.
   * Always produces a live summary of the current session.
   */
  public processIncremental(messages: ChatMessage[]): StructuredSummary {
    const newMessages = messages.filter((m) => !this.processedMessageIds.has(m.id));

    if (newMessages.length === 0) {
      return this.summary;
    }

    // Process each new message for heuristic extraction
    for (const msg of newMessages) {
      this.extractFromMessage(msg);
      this.processedMessageIds.add(msg.id);
    }

    // Update current discussion from the most recent messages
    this.updateCurrentDiscussion(messages);

    // Run TF-IDF extractive ranking over the full conversation
    const ranked = this.summarizer.summarize(messages, 5);
    this.summary.rankedSentences = ranked.map((r) => r.text);

    // Extract topic tags from the full conversation
    this.summary.topicTags = this.summarizer.extractTopics(messages, 6);

    // Track metadata
    this.summary.lastUpdatedAt = Date.now();
    this.summary.turnsCovered = messages.filter((m) => m.role === 'user').length;

    return this.summary;
  }

  /**
   * Forces a full reprocessing of all messages (used when user clicks "Regenerate").
   */
  public regenerate(messages: ChatMessage[]): StructuredSummary {
    // Reset everything
    this.summary = { ...defaultSummary };
    this.processedMessageIds = new Set();

    // Reprocess all messages
    for (const msg of messages) {
      this.extractFromMessage(msg);
      this.processedMessageIds.add(msg.id);
    }

    this.updateCurrentDiscussion(messages);

    const ranked = this.summarizer.summarize(messages, 5);
    this.summary.rankedSentences = ranked.map((r) => r.text);
    this.summary.topicTags = this.summarizer.extractTopics(messages, 6);
    this.summary.lastUpdatedAt = Date.now();
    this.summary.turnsCovered = messages.filter((m) => m.role === 'user').length;

    return this.summary;
  }

  /**
   * Extracts structured data from a single message using pattern-matching heuristics.
   */
  private extractFromMessage(msg: ChatMessage) {
    const text = msg.text;

    // === 1. Project Goal ===
    // Grab from the first user message, or any early user message with goal-like language
    if (msg.role === 'user' && !this.summary.projectGoal) {
      // Try to extract goal from common patterns
      const goalPatterns = [
        /(?:build|create|implement|develop|design|make|write|set up|setup)\s+(?:a\s+|an\s+|the\s+)?(.{10,120})/i,
        /(?:i\s+(?:want|need)\s+(?:to\s+)?|let's\s+|we\s+(?:need|should)\s+)(.{10,120})/i,
      ];

      for (const pattern of goalPatterns) {
        const match = text.match(pattern);
        if (match) {
          this.summary.projectGoal = match[0].substring(0, 120).trim();
          break;
        }
      }

      // Fallback: if this is the very first user message and still no goal, use the first line
      if (!this.summary.projectGoal && this.processedMessageIds.size === 0) {
        const firstLine = text.split('\n')[0].trim();
        if (firstLine.length > 10) {
          this.summary.projectGoal = firstLine.substring(0, 120);
        }
      }
    }

    // === 2. Links ===
    const linkRegex = /https?:\/\/[^\s)>\]]+/g;
    const links = text.match(linkRegex);
    if (links) {
      this.summary.links = [...new Set([...this.summary.links, ...links])];
    }

    // === 3. Code & Files ===
    if (text.includes('```') || text.includes('`')) {
      this.summary.codeGenerated = true;
    }

    // Extract file paths from various patterns
    const filePatterns = [
      // Import statements: import ... from './path/file'
      /(?:from\s+['"])([^'"]+)['"]/g,
      // File paths mentioned in text
      /(?:^|\s|`)([a-zA-Z0-9_\-./]+\.(?:ts|tsx|js|jsx|css|html|md|py|go|rs|json|yaml|yml|toml|sql|sh))/gm,
      // Markdown file references [file](path)
      /\[([^\]]+)\]\((?:file:\/\/\/)?([^)]+\.(?:ts|tsx|js|jsx|css|html|md))\)/g,
    ];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const filePath = (match[2] || match[1]).trim();
        if (filePath.length > 2 && filePath.length < 150 && !filePath.startsWith('http')) {
          this.summary.filesCreated = [...new Set([...this.summary.filesCreated, filePath])];
        }
      }
    }

    // === 4. Tasks ===
    const pendingMatches = [...text.matchAll(/[-*]\s*\[\s*\]\s*(.*)/g)];
    if (pendingMatches.length > 0) {
      const tasks = pendingMatches.map((m) => m[1].trim()).filter((t) => t.length > 3);
      this.summary.pendingTasks = [...new Set([...this.summary.pendingTasks, ...tasks])];
    }

    const completedMatches = [...text.matchAll(/[-*]\s*\[x\]\s*(.*)/gi)];
    if (completedMatches.length > 0) {
      const tasks = completedMatches.map((m) => m[1].trim()).filter((t) => t.length > 3);
      this.summary.completedTasks = [...new Set([...this.summary.completedTasks, ...tasks])];
      // Remove completed from pending
      this.summary.pendingTasks = this.summary.pendingTasks.filter(
        (t) => !tasks.some((ct) => ct.toLowerCase() === t.toLowerCase())
      );
    }

    // === 5. Errors & Bugs ===
    const errorPatterns = [
      /(?:error|Error|ERROR)[\s:]+(.{10,150})/g,
      /(?:TypeError|ReferenceError|SyntaxError|RangeError)[\s:]+(.{5,150})/g,
      /(?:failed to|cannot|unable to|crash|broken)\s+(.{5,100})/gi,
    ];
    for (const pattern of errorPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const bugText = match[0].trim().substring(0, 150);
        if (
          bugText.length > 10 &&
          !this.summary.bugs.some((b) => b.toLowerCase() === bugText.toLowerCase())
        ) {
          this.summary.bugs.push(bugText);
        }
      }
    }
    // Cap bugs to avoid noise
    if (this.summary.bugs.length > 10) {
      this.summary.bugs = this.summary.bugs.slice(-10);
    }

    // === 6. Architecture Decisions ===
    // Look in both user and AI messages for decision language
    const decisionPatterns = [
      /(?:decided to|chose to|will use|going with|opted for|approach:?|pattern:?|strategy:?)\s+(.{10,150})/gi,
      /(?:we(?:'ll| will| should)\s+(?:use|implement|adopt|follow))\s+(.{10,120})/gi,
    ];
    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const decision = match[0].trim().substring(0, 150);
        if (
          !this.summary.architectureDecisions.some((d) =>
            d.toLowerCase().includes(decision.toLowerCase().slice(0, 30))
          )
        ) {
          this.summary.architectureDecisions.push(decision);
        }
      }
    }
    if (this.summary.architectureDecisions.length > 8) {
      this.summary.architectureDecisions = this.summary.architectureDecisions.slice(-8);
    }

    // === 7. APIs & Services ===
    const apiPatterns = [
      /(?:chrome\.[a-zA-Z.]+)/g,
      /(?:fetch|axios|XMLHttpRequest)\s*\(/g,
      /(?:[A-Z][a-zA-Z]+(?:API|Service|Client|Provider|Manager|Engine))/g,
    ];
    for (const pattern of apiPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        this.summary.apis = [
          ...new Set([...this.summary.apis, ...matches.map((a) => a.replace(/[()]/g, '').trim())]),
        ];
      }
    }
    if (this.summary.apis.length > 15) {
      this.summary.apis = this.summary.apis.slice(-15);
    }

    // === 8. User Preferences ===
    if (msg.role === 'user') {
      const prefPatterns = [
        /(?:i\s+prefer|don't use|always use|never use|please use|make sure to)\s+(.{5,100})/gi,
        /(?:style:?|format:?|convention:?)\s+(.{5,80})/gi,
      ];
      for (const pattern of prefPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const pref = match[0].trim().substring(0, 120);
          if (!this.summary.userPreferences.some((p) => p.toLowerCase() === pref.toLowerCase())) {
            this.summary.userPreferences.push(pref);
          }
        }
      }
    }

    // === 9. Facts ===
    // Extract factual statements from AI responses
    if (msg.role === 'ai') {
      const factPatterns = [
        /(?:note that|important:?|remember that|key point:?|tip:?)\s+(.{10,150})/gi,
      ];
      for (const pattern of factPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const fact = match[0].trim().substring(0, 150);
          if (
            !this.summary.facts.some((f) =>
              f.toLowerCase().includes(fact.toLowerCase().slice(0, 30))
            )
          ) {
            this.summary.facts.push(fact);
          }
        }
      }
      if (this.summary.facts.length > 10) {
        this.summary.facts = this.summary.facts.slice(-10);
      }
    }
  }

  /**
   * Builds a current discussion summary from the last few messages.
   */
  private updateCurrentDiscussion(messages: ChatMessage[]) {
    // Take the last 4 messages to figure out current discussion context
    const recent = messages.slice(-4);
    if (recent.length === 0) return;

    const parts: string[] = [];
    for (const msg of recent) {
      // Take the first meaningful line of each recent message
      const lines = msg.text.split('\n').filter((l) => l.trim().length > 5);
      if (lines.length > 0) {
        const firstLine = lines[0]
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[#*`]/g, '')
          .trim();
        if (firstLine.length > 5) {
          const prefix = msg.role === 'user' ? 'User' : 'AI';
          parts.push(`${prefix}: ${firstLine.substring(0, 80)}`);
        }
      }
    }

    this.summary.currentDiscussion = parts.slice(-3).join(' → ');
  }
}
