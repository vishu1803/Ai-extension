import { ChatMessage } from '../../adapters/engineTypes';
import { ContextHealthMetrics, HealthScore, HealthStatus } from '../../shared/types';

interface DegradationInput {
  messages: ChatMessage[];
  totalTokens: number;
  contextLimit: number;
  thresholds: {
    caution: number;
    warning: number;
    critical: number;
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFromScore(score: number, thresholds: DegradationInput['thresholds']): HealthStatus {
  if (score >= thresholds.critical) return 'critical';
  if (score >= thresholds.warning) return 'warning';
  if (score >= thresholds.caution) return 'caution';
  return 'healthy';
}

function tokenizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = tokenizeWords(a);
  const wordsB = tokenizeWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection += 1;
  }

  return intersection / (wordsA.size + wordsB.size - intersection);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class DegradationEngine {
  public evaluate(input: DegradationInput): HealthScore {
    const contextFill = input.contextLimit > 0 ? (input.totalTokens / input.contextLimit) * 100 : 0;
    const assistantMessages = input.messages.filter((message) => message.role === 'ai');
    const userMessages = input.messages.filter((message) => message.role === 'user');

    const repetition = this.measureRepetition(assistantMessages);
    const lengthDrift = this.measureLengthDrift(assistantMessages);
    const instructionDrift = this.measureInstructionDrift(userMessages.length);
    const explicitForgetfulness = this.measureExplicitForgetfulness(assistantMessages);

    const signals: HealthScore['signals'] = {
      contextFill: {
        value: clampScore(contextFill),
        weight: 0.45,
        label: 'Context Fill',
        description: 'Percentage of the configured context window currently used.',
      },
      repetition: {
        value: repetition,
        weight: 0.2,
        label: 'Repetition',
        description: 'Similarity between recent assistant responses.',
      },
      lengthDrift: {
        value: lengthDrift,
        weight: 0.15,
        label: 'Length Drift',
        description: 'Recent assistant responses becoming much shorter than earlier responses.',
      },
      instructionDrift: {
        value: instructionDrift,
        weight: 0.1,
        label: 'Instruction Drift',
        description: 'Risk proxy based on long conversation turn count.',
      },
      explicitForgetfulness: {
        value: explicitForgetfulness,
        weight: 0.1,
        label: 'Explicit Forgetfulness',
        description: 'Assistant language indicating lost context or missing memory.',
      },
    };

    const overall = clampScore(
      Object.values(signals).reduce((sum, signal) => sum + signal.value * signal.weight, 0)
    );

    return {
      overall,
      status: statusFromScore(Math.max(overall, contextFill), input.thresholds),
      signals,
    };
  }

  public toLegacyMetrics(score: HealthScore): ContextHealthMetrics {
    return {
      repetition:
        score.signals.repetition.value >= 70
          ? 'High'
          : score.signals.repetition.value >= 35
            ? 'Medium'
            : 'Low',
      lengthDrift:
        score.signals.lengthDrift.value >= 60
          ? 'Shrinking'
          : score.signals.lengthDrift.value >= 30
            ? 'Growing'
            : 'Stable',
      instruction:
        score.signals.instructionDrift.value >= 70
          ? 'Poor'
          : score.signals.instructionDrift.value >= 35
            ? 'Fair'
            : 'Good',
      explicit:
        score.signals.explicitForgetfulness.value >= 70
          ? 'High'
          : score.signals.explicitForgetfulness.value >= 35
            ? 'Some'
            : 'None',
    };
  }

  private measureRepetition(messages: ChatMessage[]): number {
    const recent = messages.slice(-4);
    if (recent.length < 2) return 0;

    const similarities: number[] = [];
    for (let index = 1; index < recent.length; index += 1) {
      similarities.push(jaccardSimilarity(recent[index - 1].text, recent[index].text));
    }

    return clampScore(average(similarities) * 100);
  }

  private measureLengthDrift(messages: ChatMessage[]): number {
    if (messages.length < 4) return 0;

    const midpoint = Math.floor(messages.length / 2);
    const earlyAverage = average(messages.slice(0, midpoint).map((message) => message.text.length));
    const recentAverage = average(messages.slice(-midpoint).map((message) => message.text.length));
    if (earlyAverage === 0 || recentAverage >= earlyAverage) return 0;

    return clampScore(((earlyAverage - recentAverage) / earlyAverage) * 100);
  }

  private measureInstructionDrift(userTurnCount: number): number {
    if (userTurnCount <= 8) return 0;
    return clampScore((userTurnCount - 8) * 5);
  }

  private measureExplicitForgetfulness(messages: ChatMessage[]): number {
    const patterns = [
      /\bi (?:do not|don't) (?:remember|recall|have access)\b/i,
      /\b(?:lost|missing) (?:context|track)\b/i,
      /\bcan you remind me\b/i,
      /\bi no longer have\b/i,
    ];

    const recent = messages.slice(-6);
    const matches = recent.filter((message) =>
      patterns.some((pattern) => pattern.test(message.text))
    ).length;
    return clampScore((matches / Math.max(1, recent.length)) * 100);
  }
}
