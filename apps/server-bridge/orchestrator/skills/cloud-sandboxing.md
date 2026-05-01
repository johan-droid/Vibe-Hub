# Cloud Sandboxing Protocol — Phase 2

Use this protocol when performing high-risk operations, heavy builds, or complex integration tests that require a full Linux environment.

## 1. When to use Cloud Sandboxing
- **High-Risk Changes**: Modifying core database schemas, authentication flows, or shared utilities that touch many files.
- **Heavy Lift Builds**: Building production-ready bundles that would slow down the browser environment.
- **Full-Stack Verification**: Running tests that require external services (e.g., Docker, PostgreSQL, Redis) that aren't available in WebContainer.

## 2. Spawning a Sandbox
1. **Commit your work** to a feature branch (e.g., `fix-auth-flow`).
2. **Push the branch** to GitHub.
3. Call `github_create_codespace` with the repository name and your branch.
4. Inform the user that validation is moving to the cloud.

## 3. Remote Execution
- Once the Codespace is ready, the agent can connect to it (via future bridge logic) or you can instruct the user to check the "Vibe Hub Cloud Runner".
- Report completion status back to the PR using `github_post_comment`.

## 4. Cost Efficiency
- ALWAYS delete the Codespace after validation is complete using `github_delete_codespace` (if implemented in the tool set).
- Prefer smaller machine types unless a heavy build is required.
