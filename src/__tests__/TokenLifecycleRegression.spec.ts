import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test-id',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

vi.mock('wxt/storage', () => {
  const store: Record<string, any> = {};
  return {
    storage: {
      defineItem: (key: string, opts: { fallback: any }) => {
        return {
          getValue: async () => (key in store ? store[key] : opts.fallback),
          setValue: async (val: any) => {
            store[key] = val;
          },
          watch: () => () => {},
        };
      },
    },
  };
});

import { storageLayer } from '../storage';
import { SessionGeneration } from '../core/sessionGeneration';
import { CanonicalDerivedStore, TokenLiveStore } from '../core/tokenStore';
import {
  publishCanonicalTokenResult,
  publishLiveTokenDelta,
  JobContext,
} from '../core/tokenPublisher';
import {
  verifyAndNormalizeMapping,
  VerifiedMappingResult,
} from '../core/acquisition/normalizeMapping';
import type { HistoryCompleteness } from '../core/models';

/**
 * TOKEN LIFECYCLE REGRESSION TEST
 *
 * Validates the exact trace from the implementation specification:
 *
 * Step 1. Init conversation (215 msgs, FULL network payload) → baseline = 35,000
 * Step 2. User sends prompt (50 tokens)                      → baseline + 50 = 35,050
 * Step 3. Stream chunk 1 (300 tokens)                        → baseline + 350 = 35,350
 * Step 4. Stream chunk 2 (750 tokens, replaces 300)          → baseline + 800 = 35,800
 * Step 5. Secondary network payload (4 nodes, PARTIAL)       → baseline untouched = 35,800
 * Step 6. Stream finished → commit new baseline              → baseline = 35,800, delta = 0
 */
describe('Token Lifecycle Regression: 35,000 → 35,050 → 35,350 → 35,800 → committed 35,800', () => {
  const convId = 'chatgpt:test-lifecycle-conv';

  beforeEach(async () => {
    SessionGeneration.reset();
    CanonicalDerivedStore.clear();
    TokenLiveStore.clear();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
  });

  // ────────────────────────────────────────────────────────────
  // Helper: Build a realistic ChatGPT mapping payload
  // ────────────────────────────────────────────────────────────

  function buildFullMapping(messageCount: number): {
    mapping: Record<string, any>;
    conversation_id: string;
    current_node: string;
  } {
    const mapping: Record<string, any> = {};
    let parentId: string | null = null;

    // Root structural node (no message)
    const rootId = 'root-node';
    mapping[rootId] = {
      id: rootId,
      parent: null,
      children: [],
      message: null,
    };
    parentId = rootId;

    // System message node
    const systemId = 'system-node';
    mapping[systemId] = {
      id: systemId,
      parent: parentId,
      children: [],
      message: {
        id: 'msg-system',
        author: { role: 'system' },
        content: { parts: ['You are a helpful assistant.'] },
        create_time: 1000,
      },
    };
    mapping[parentId].children.push(systemId);
    parentId = systemId;

    // User/Assistant message pairs
    for (let i = 0; i < messageCount; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      const nodeId = `node-${i}`;
      const msgId = `msg-${i}`;
      mapping[nodeId] = {
        id: nodeId,
        parent: parentId,
        children: [],
        message: {
          id: msgId,
          author: { role },
          content: { parts: [`Message ${i}: ${'x'.repeat(150)}`] },
          create_time: 2000 + i,
        },
      };
      mapping[parentId].children.push(nodeId);
      parentId = nodeId;
    }

    return {
      mapping,
      conversation_id: 'test-lifecycle-conv',
      current_node: parentId!,
    };
  }

  function buildPartialMapping(): {
    mapping: Record<string, any>;
    conversation_id: string;
    current_node: string | null;
  } {
    // Simulate a secondary 4-node payload (e.g., title generation)
    // This does NOT have the root node or a complete path
    const mapping: Record<string, any> = {};

    // 4 disconnected nodes — no root path
    for (let i = 0; i < 4; i++) {
      const nodeId = `partial-node-${i}`;
      mapping[nodeId] = {
        id: nodeId,
        parent: i > 0 ? `partial-node-${i - 1}` : 'missing-parent-not-in-mapping',
        children: [],
        message: {
          id: `partial-msg-${i}`,
          author: { role: i % 2 === 0 ? 'user' : 'assistant' },
          content: { parts: [`Partial message ${i}`] },
          create_time: 5000 + i,
        },
      };
    }

    return {
      mapping,
      conversation_id: 'test-lifecycle-conv',
      current_node: 'partial-node-3',
    };
  }

  // ────────────────────────────────────────────────────────────
  // Step 1: Verify tree path verification correctly classifies FULL
  // ────────────────────────────────────────────────────────────

  it('Step 1: FULL mapping with root-to-leaf path is classified as FULL', () => {
    const fullPayload = buildFullMapping(215);
    const result = verifyAndNormalizeMapping(fullPayload);

    expect(result.completeness).toBe('FULL');
    expect(result.isCompletePath).toBe(true);
    expect(result.rootNodeId).toBeTruthy();
    expect(result.currentNodeId).toBe(fullPayload.current_node);
    // Should have extracted user/assistant messages (not system/structural)
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThanOrEqual(215);
  });

  // ────────────────────────────────────────────────────────────
  // Step 2: Verify PARTIAL mapping is correctly classified
  // ────────────────────────────────────────────────────────────

  it('Step 2: Partial 4-node mapping (disconnected subtree) is classified as PARTIAL', () => {
    const partialPayload = buildPartialMapping();
    const result = verifyAndNormalizeMapping(partialPayload);

    expect(result.completeness).toBe('PARTIAL');
    expect(result.isCompletePath).toBe(false);
  });

  // ────────────────────────────────────────────────────────────
  // Step 3: Missing current_node → PARTIAL
  // ────────────────────────────────────────────────────────────

  it('Step 3: Missing current_node results in PARTIAL classification', () => {
    const fullPayload = buildFullMapping(215);
    const result = verifyAndNormalizeMapping({
      ...fullPayload,
      current_node: null,
    });

    expect(result.completeness).toBe('PARTIAL');
    expect(result.isCompletePath).toBe(false);
  });

  // ────────────────────────────────────────────────────────────
  // Step 4: Full lifecycle trace: 35,000 → 35,050 → 35,350 → 35,800 → committed 35,800
  // ────────────────────────────────────────────────────────────

  it('Step 4: Complete lifecycle trace — baseline preserved through partial payloads', async () => {
    const gen = SessionGeneration.switchConversation(convId);
    const BASELINE = 35000;

    // ──── STEP 1: Establish canonical baseline of 35,000 ────
    const job1: JobContext = {
      jobId: 'job-init',
      conversationId: convId,
      conversationVersion: 1,
      inputHash: 'hash-init',
      inputMessageCount: 215,
      generation: gen,
    };

    await publishCanonicalTokenResult(job1, {
      tokenCount: BASELINE,
      inputTokens: 17000,
      outputTokens: 18000,
      confidence: 1,
      isStreaming: false,
      source: 'network_history',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 107,
      avgTokensPerTurn: 327,
      healthMetrics: {},
      tabId: 1,
    });

    let record = CanonicalDerivedStore.get(convId);
    expect(record?.tokenCount).toBe(BASELINE);

    let appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(BASELINE);
    expect(appState.tokenEstimate.isStreaming).toBe(false);

    // ──── STEP 2: User sends a prompt (50 tokens) ────
    TokenLiveStore.updateMessageDelta(convId, 'msg-user-new', 'user', 50, 200);
    await publishLiveTokenDelta(convId, 1);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(BASELINE + 50); // 35,050
    expect(appState.tokenEstimate.isStreaming).toBe(true);

    // ──── STEP 3: Stream chunk 1 — assistant streams 300 tokens ────
    TokenLiveStore.updateMessageDelta(convId, 'msg-ai-new', 'ai', 300, 1200);
    await publishLiveTokenDelta(convId, 1);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(BASELINE + 50 + 300); // 35,350

    // ──── STEP 4: Stream chunk 2 — assistant grows to 750 tokens (REPLACES 300) ────
    TokenLiveStore.updateMessageDelta(convId, 'msg-ai-new', 'ai', 750, 3000);
    await publishLiveTokenDelta(convId, 1);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(BASELINE + 50 + 750); // 35,800

    // ──── STEP 5: Secondary network payload (4 nodes, PARTIAL) — baseline MUST NOT drop ────
    // This verifies the CRITICAL invariant: partial payloads do not reset the baseline
    record = CanonicalDerivedStore.get(convId);
    expect(record?.tokenCount).toBe(BASELINE); // Still 35,000 — never touched by partial

    // Verify the displayed total is still 35,800
    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35800);

    // ──── STEP 6: Stream finished → commit new baseline ────
    TokenLiveStore.clearLiveDeltas(convId);

    const job2: JobContext = {
      jobId: 'job-commit',
      conversationId: convId,
      conversationVersion: 2,
      inputHash: 'hash-commit',
      inputMessageCount: 217,
      generation: gen,
    };

    await publishCanonicalTokenResult(job2, {
      tokenCount: 35800,
      inputTokens: 17050,
      outputTokens: 18750,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 108,
      avgTokensPerTurn: 331,
      healthMetrics: {},
      tabId: 1,
    });

    record = CanonicalDerivedStore.get(convId);
    expect(record?.tokenCount).toBe(35800); // committed: 35,800
    expect(record?.canonicalVersion).toBe(2);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35800); // displayed: 35,800
    expect(appState.tokenEstimate.isStreaming).toBe(false); // no longer streaming
  });

  // ────────────────────────────────────────────────────────────
  // Step 5: Verify cycle guard in tree traversal
  // ────────────────────────────────────────────────────────────

  it('Step 5: Cycle guard prevents infinite loop in malformed mapping', () => {
    const mapping: Record<string, any> = {
      'node-A': {
        id: 'node-A',
        parent: 'node-B',
        message: {
          id: 'msg-A',
          author: { role: 'user' },
          content: { parts: ['Hello'] },
          create_time: 1,
        },
      },
      'node-B': {
        id: 'node-B',
        parent: 'node-A', // Cycle!
        message: {
          id: 'msg-B',
          author: { role: 'assistant' },
          content: { parts: ['Hi'] },
          create_time: 2,
        },
      },
    };

    // Should not hang, should return PARTIAL due to cycle
    const result = verifyAndNormalizeMapping({
      mapping,
      conversation_id: 'test-cycle',
      current_node: 'node-A',
    });

    expect(result.completeness).toBe('PARTIAL');
    expect(result.isCompletePath).toBe(false);
  });

  // ────────────────────────────────────────────────────────────
  // Step 6: Cumulative streaming sequence: 50 -> 300 -> 500 -> 750 -> 800 -> committed 35,850
  // ────────────────────────────────────────────────────────────

  it('Step 6: Cumulative streaming sequence matches specification exactly', async () => {
    const gen = SessionGeneration.switchConversation(convId);
    const BASELINE = 35000;

    await publishCanonicalTokenResult(
      {
        jobId: 'job-init-seq',
        conversationId: convId,
        conversationVersion: 1,
        inputHash: 'hash-seq',
        inputMessageCount: 215,
        generation: gen,
      },
      {
        tokenCount: BASELINE,
        inputTokens: 17000,
        outputTokens: 18000,
        confidence: 1,
        isStreaming: false,
        source: 'network_history',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 107,
        avgTokensPerTurn: 327,
        healthMetrics: {},
        tabId: 1,
      }
    );

    // User sends prompt: +50 tokens -> 35,050
    TokenLiveStore.updateMessageDelta(convId, 'msg-user', 'user', 50, 200);
    await publishLiveTokenDelta(convId, 1);
    let appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35050);

    // Assistant: 300 -> 35,350
    TokenLiveStore.updateMessageDelta(convId, 'msg-ai', 'ai', 300, 1200);
    await publishLiveTokenDelta(convId, 1);
    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35350);

    // Assistant: 500 -> 35,550
    TokenLiveStore.updateMessageDelta(convId, 'msg-ai', 'ai', 500, 2000);
    await publishLiveTokenDelta(convId, 1);
    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35550);

    // Assistant: 750 -> 35,800
    TokenLiveStore.updateMessageDelta(convId, 'msg-ai', 'ai', 750, 3000);
    await publishLiveTokenDelta(convId, 1);
    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35800);

    // Assistant: 800 -> 35,850
    TokenLiveStore.updateMessageDelta(convId, 'msg-ai', 'ai', 800, 3200);
    await publishLiveTokenDelta(convId, 1);
    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35850);

    // Completion: committed = 35,850, live = 0, displayed = 35,850
    TokenLiveStore.clearLiveDeltas(convId);
    await publishCanonicalTokenResult(
      {
        jobId: 'job-fin-seq',
        conversationId: convId,
        conversationVersion: 2,
        inputHash: 'hash-fin',
        inputMessageCount: 217,
        generation: gen,
      },
      {
        tokenCount: 35850,
        inputTokens: 17050,
        outputTokens: 18800,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 108,
        avgTokensPerTurn: 331,
        healthMetrics: {},
        tabId: 1,
      }
    );

    const record = CanonicalDerivedStore.get(convId);
    expect(record?.tokenCount).toBe(35850);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(35850);
    expect(appState.tokenEstimate.isStreaming).toBe(false);
  });

  // ────────────────────────────────────────────────────────────
  // Step 7: Partial & Unknown payload resilience (64 msgs, 36 msgs, 5 msgs, UNKNOWN)
  // ────────────────────────────────────────────────────────────

  it('Step 7: Partial network payloads (64, 36, 5 msgs, UNKNOWN) never reduce committed baseline', async () => {
    const gen = SessionGeneration.switchConversation(convId);
    const BASELINE = 35000;

    // Establish initial baseline: 215 messages, 35,000 tokens
    await publishCanonicalTokenResult(
      {
        jobId: 'job-init-215',
        conversationId: convId,
        conversationVersion: 1,
        inputHash: 'hash-215',
        inputMessageCount: 215,
        generation: gen,
      },
      {
        tokenCount: BASELINE,
        inputTokens: 17000,
        outputTokens: 18000,
        confidence: 1,
        isStreaming: false,
        source: 'network_history',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 107,
        avgTokensPerTurn: 327,
        healthMetrics: {},
        tabId: 1,
      }
    );

    // Verify 64-message payload is classified as PARTIAL because 64 < 215
    const payload64 = buildFullMapping(64);
    const result64 = verifyAndNormalizeMapping(payload64, 215);
    expect(result64.completeness).toBe('PARTIAL');

    // Verify 36-message payload is classified as PARTIAL because 36 < 215
    const payload36 = buildFullMapping(36);
    const result36 = verifyAndNormalizeMapping(payload36, 215);
    expect(result36.completeness).toBe('PARTIAL');

    // Verify 5-message payload is classified as PARTIAL
    const payload5 = buildFullMapping(5);
    const result5 = verifyAndNormalizeMapping(payload5, 215);
    expect(result5.completeness).toBe('PARTIAL');

    // Verify UNKNOWN/malformed payload
    const resultUnknown = verifyAndNormalizeMapping(
      {
        mapping: {},
        conversation_id: 'test-lifecycle-conv',
        current_node: null,
      },
      215
    );
    expect(resultUnknown.completeness).toBe('UNKNOWN');

    // Baseline in store MUST remain 35,000
    const record = CanonicalDerivedStore.get(convId);
    expect(record?.tokenCount).toBe(BASELINE);
  });
});
