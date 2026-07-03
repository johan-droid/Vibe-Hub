import { Octokit } from 'octokit';

export class GithubBridge {
    constructor(token) {
        this.octokit = new Octokit({ auth: token });
    }

    async openPullRequest(owner, repo, head, base, title, agentDescription) {
        try {
            const response = await this.octokit.rest.pulls.create({
                owner,
                repo,
                head,
                base,
                title,
                body: agentDescription
            });
            return response.data;
        } catch (error) {
            console.error("Failed to open pull request:", error);
            throw error;
        }
    }

    // Pseudo webhook listener structure routing to Triage (Layer 1)
    handleWebhookEvent(event) {
        const { action, pull_request, comment, check_run } = event;

        // Route to Layer 1 Triage entry point
        // TriageAgent.processIncoming(eventData)

        if (action === 'created' && comment) {
             console.log("Routing PR comment to Triage Agent");
             // TriageAgent.processGithubComment(comment);
        } else if (check_run && check_run.conclusion === 'failure') {
             console.log("Routing CI failure to Triage Agent");
             // TriageAgent.processCIFailure(check_run);
        }
    }
}
