// using groq sdk hypothetically or simple fetch if needed, assuming TokenGovernor could return a fast model
import { TokenGovernor } from '../token-governor.js';

export class ContextPruner {
    constructor() {
        this.governor = new TokenGovernor();
    }

    async pruneSessionMemory(messageHistory) {
        // Very basic token count estimation (words * 1.3)
        const estimateTokens = (text) => text.split(/\s+/).length * 1.3;

        let totalTokens = messageHistory.reduce((acc, msg) => acc + estimateTokens(msg.content), 0);

        if (totalTokens > 10000) {
            const splitIndex = Math.floor(messageHistory.length / 2);
            const oldestMessages = messageHistory.slice(0, splitIndex);
            const remainingMessages = messageHistory.slice(splitIndex);

            const textToSummarize = oldestMessages.map(m => `${m.role}: ${m.content}`).join('\n');

            // Fast Groq model
            const aiClient = this.governor.requestModel('low', 'planner'); // Assuming this maps to a fast model like Groq in governor
            const systemPrompt = "Summarize & Condense the following conversation history into a single paragraph.";

            try {
                const response = await aiClient.generateContent({
                    contents: [{ role: 'user', parts: [{ text: textToSummarize }] }],
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
                });

                const summary = response.response.text();

                // Return new history with summary as first message
                return [
                    { role: 'system', content: `[Summarized History]: ${summary}` },
                    ...remainingMessages
                ];
            } catch (error) {
                console.error("Context pruning failed", error);
                return messageHistory; // Fallback to unpruned history
            }
        }
        return messageHistory;
    }
}
