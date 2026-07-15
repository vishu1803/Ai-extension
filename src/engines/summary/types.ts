export interface StructuredSummary {
  projectGoal: string;
  facts: string[];
  architectureDecisions: string[];
  codeGenerated: boolean;
  filesCreated: string[];
  bugs: string[];
  pendingTasks: string[];
  completedTasks: string[];
  links: string[];
  apis: string[];
  userPreferences: string[];
  currentDiscussion: string;
  rankedSentences?: string[];
  topicTags: string[];
  lastUpdatedAt: number;
  turnsCovered: number;
}

export const defaultSummary: StructuredSummary = {
  projectGoal: '',
  facts: [],
  architectureDecisions: [],
  codeGenerated: false,
  filesCreated: [],
  bugs: [],
  pendingTasks: [],
  completedTasks: [],
  links: [],
  apis: [],
  userPreferences: [],
  currentDiscussion: '',
  rankedSentences: [],
  topicTags: [],
  lastUpdatedAt: 0,
  turnsCovered: 0,
};
