import { countMessageTokens, extractMessageText } from '../../memory/tokenizer.js';
import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

const DEFAULT_MAX_HISTORY_TOKENS = 10000;
const DEFAULT_TARGET_HISTORY_TOKENS = 8000;
const DEFAULT_RECENT_USER_TURNS = 4;
const DEFAULT_SUMMARY_OUTPUT_TOKENS = 256;

export class ContextPruner {
    constructor(options = {}) {
        this.governor = new TokenGovernor();
        this.maxHistoryTokens = options.maxHistoryTokens || DEFAULT_MAX_HISTORY_TOKENS;
        this.targetHistoryTokens = options.targetHistoryTokens || DEFAULT_TARGET_HISTORY_TOKENS;
        this.recentUserTurns = options.recentUserTurns || DEFAULT_RECENT_USER_TURNS;
        this.summaryOutputTokens = options.summaryOutputTokens || DEFAULT_SUMMARY_OUTPUT_TOKENS;
    }

    async pruneSessionMemory(messageHistory) {
        if (!Array.isArray(messageHistory) || messageHistory.length === 0) {
            return messageHistory;
        }

        if (this.totalHistoryTokens(messageHistory) <= this.maxHistoryTokens) {
            return messageHistory;
        }

        const anchorMessage = isSystemMessage(messageHistory[0]) ? messageHistory[0] : null;
        const historyBody = anchorMessage ? messageHistory.slice(1) : [...messageHistory];
        const recentWindowStart = findRecentWindowStart(historyBody, this.recentUserTurns);
        const recentMessages = historyBody.slice(recentWindowStart);
        const prunableMessages = historyBody.slice(0, recentWindowStart);

        let summaryMessage = null;
        if (prunableMessages.length > 0) {
            summaryMessage = await this.summarizePrunedHistory(prunableMessages, recentMessages[0] || historyBody[0]);
        }

        let prunedHistory = [
            ...(anchorMessage ? [anchorMessage] : []),
            ...(summaryMessage ? [summaryMessage] : []),
            ...recentMessages,
        ];

        const anchorCount = anchorMessage ? 1 : 0;
        const preservedPrefixCount = anchorCount + (summaryMessage ? 1 : 0);
        prunedHistory = trimHistoryToBudget(prunedHistory, this.targetHistoryTokens, anchorCount, preservedPrefixCount);
        return ensureConversationStartsOnUser(prunedHistory, anchorCount);
    }

    totalHistoryTokens(messageHistory) {
        return messageHistory.reduce((sum, message) => sum + countMessageTokens(message), 0);
    }

    async summarizePrunedHistory(messagesToSummarize, shapeHint) {
        const systemPrompt = [
            'You are a context pruner for a coding agent.',
            'Compress the older conversation into a compact handoff.',
            'Keep only durable facts: requirements, decisions, failed attempts, file paths, and pending risks.',
            'Output plain text under 220 tokens.'
        ].join(' ');
        const userPrompt = messagesToSummarize
            .map(message => `${message.role || 'unknown'}: ${extractMessageText(message)}`)
            .join('\n\n');

        try {
            const summary = await this.governor.getCompute('low', 'planner', (key, model, provider) => (
                callRoutedTextModel(key, model, systemPrompt, userPrompt, {
                    provider,
                    maxOutputTokens: this.summaryOutputTokens,
                })
            ));

            if (!summary || !summary.trim()) {
                return null;
            }

            return createSummaryMessage(summary.trim(), shapeHint);
        } catch (error) {
            console.error('Context pruning summary failed', error);
            return null;
        }
    }
}

function findRecentWindowStart(messages, recentUserTurns) {
    if (messages.length === 0) return 0;

    let userTurnsSeen = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (isUserLikeMessage(messages[index])) {
            userTurnsSeen += 1;
            if (userTurnsSeen >= recentUserTurns) {
                return index;
            }
        }
    }

    return 0;
}

function trimHistoryToBudget(messages, tokenBudget, anchorCount, preservedPrefixCount) {
    const pruned = [...messages];

    while (pruned.length > preservedPrefixCount && totalTokens(pruned) > tokenBudget) {
        removeOldestExchange(pruned, preservedPrefixCount);
    }

    while (pruned.length > anchorCount + 1 && totalTokens(pruned) > tokenBudget) {
        pruned.splice(anchorCount, 1);
    }

    return pruned;
}

function ensureConversationStartsOnUser(messages, anchorCount) {
    if (messages.length <= anchorCount) return messages;

    const anchored = messages.slice(0, anchorCount);
    const body = messages.slice(anchorCount);
    const firstUserIndex = body.findIndex(isUserLikeMessage);
    if (firstUserIndex <= 0) {
        return messages;
    }

    return [...anchored, ...body.slice(firstUserIndex)];
}

function createSummaryMessage(summary, shapeHint) {
    const text = `Context summary:\n${summary}`;
    if (Array.isArray(shapeHint?.parts)) {
        return { role: 'user', parts: [{ text }] };
    }
    return { role: 'user', content: text };
}

function totalTokens(messages) {
    return messages.reduce((sum, message) => sum + countMessageTokens(message), 0);
}

function removeOldestExchange(messages, startIndex) {
    if (messages.length <= startIndex) return;

    let endIndex = startIndex + 1;
    while (endIndex < messages.length && !isUserLikeMessage(messages[endIndex])) {
        endIndex += 1;
    }

    messages.splice(startIndex, endIndex - startIndex);
}

function isSystemMessage(message) {
    return message?.role === 'system';
}

function isUserLikeMessage(message) {
    return message?.role === 'user';
}
