### Phase 1: Render Backend - The Orchestrator & Native Gemini SDK

To strip legacy wrappers and enforce native Gemini SDK usage, I refactored `apps/server-bridge/orchestrator/models.js`. It now initializes `GoogleGenerativeAI` directly and defines a structured JSON schema for GitHub interactions.

**File:** `apps/server-bridge/orchestrator/models.js`
**Explanation:**
Removed any legacy format mapping for OpenAI endpoints and exclusively utilized `GoogleGenerativeAI`. Added `githubToolDeclaration` directly to `generationConfig` to enable the Swarm to securely orchestrate GitHub REST operations. Space/Time complexity is improved by removing intermediate parsing layers and executing structured generation in a single pass.

**Refactored Code Block:**
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class ModelService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Define the native tool schema for GitHub
    this.githubToolDeclaration = {
      name: 'github_api_request',
      description: 'Dispatches secure REST calls to the GitHub API on behalf of the user.',
      parameters: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', description: 'The GitHub API endpoint (e.g. /repos/{owner}/{repo}/pulls)' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
          body: { type: 'string', description: 'JSON payload' }
        },
        required: ['endpoint', 'method']
      }
    };
  }

  async chat(installationId, { model = 'gemini-2.0-flash', messages, max_tokens = 2048, useTools = true }) {
    const geminiModel = this.genAI.getGenerativeModel({
      model,
      generationConfig: { maxOutputTokens: max_tokens },
      tools: useTools ? [{ functionDeclarations: [this.githubToolDeclaration] }] : undefined
    });

    const lastMessage = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chatSession = geminiModel.startChat({ history });

    try {
      const result = await chatSession.sendMessage(lastMessage);
      const functionCalls = result.response.functionCalls();
      if (functionCalls && functionCalls.length > 0) return { toolCalls: functionCalls };
      return { content: result.response.text() };
    } catch (e) {
      console.error('[ModelService] Chat error:', e);
      throw e;
    }
  }
}
export const modelService = new ModelService();
```

### Phase 2: GitHub Ecosystem - Sandboxing & Execution

To offload heavy lifting, we removed the local Docker `security-sandbox.js` dependencies. Instead, the Node backend triggers workflows and listens to `workflow_run` webhooks.

**Endpoints & Webhooks:**
- **Trigger Workflow:** `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`
- **Webhook Listener:** The Render endpoint (`POST /api/github/webhook`) listens for the `workflow_run` event to track `conclusion` statuses (success/failure).

**File:** `.github/workflows/ai-sandbox.yml`
**Explanation:**
This workflow replaces local Docker limits. It isolates execution to GitHub's infrastructure and implements native CodeQL scanning. CPU overhead on the Render host drops from potentially gigabytes/multiple cores to near zero, as the backend now only maintains a lightweight WebSocket connection awaiting a webhook trigger. Space/Time complexity on the host machine transitions from O(N) resource utilization per script to O(1) webhook parsing.

**Refactored Code Block:**
```yaml
name: AI Sandbox & Security Audit
on:
  workflow_dispatch:
  push:
    branches:
      - 'ai/feature-*'
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test

  security-audit:
    runs-on: ubuntu-latest
    permissions: { security-events: write, actions: read, contents: read }
    steps:
      - uses: actions/checkout@v4
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with: { languages: javascript }
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

### Phase 3: SaaS-Level Frontend Integration

To mask the asynchronous latency of GitHub Actions, the React frontend injects `Framer Motion` components to represent "Waiting" states visually.

**File:** `apps/user-interface/src/features/editor/components/Terminal.jsx` & `Dashboard.jsx` & `DiffViewer.jsx`
**Explanation:**
The dashboard now actively listens to `neuralStatus.waitingForGitHub`. `DiffViewer` was refactored to conditionally render arrays of file modifications (PR reviews). Time complexity for React diffing remains optimal as we parse the first diff preview immediately rather than blocking the UI thread computing large multi-file ASTs.

**Refactored Code Block (Terminal.jsx Excerpt):**
```jsx
{lines.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-48 gap-4 opacity-20">
    {neuralStatus?.waitingForGitHub ? (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        <Surface elevation={1} shape="full" className="w-12 h-12 flex items-center justify-center border-t-2 border-primary border-outline-variant/30">
        </Surface>
      </motion.div>
    ) : (
      <Surface elevation={1} shape="full" className="w-12 h-12 flex items-center justify-center border border-outline-variant/30">
         <Play size={20} className="text-on-surface ml-1" />
      </Surface>
    )}
    <span className="label-small font-mono uppercase tracking-[0.5em]">
      {neuralStatus?.waitingForGitHub ? 'Awaiting_GitHub_Runner...' : 'Idle_System'}
    </span>
  </div>
) : (
```
