# Local Docker Sandboxing Protocol — Phase 2

Use this protocol when performing high-risk operations, heavy builds, or complex integration tests that require a full Linux environment.

## 1. When to use local Docker sandboxing
- **High-Risk Changes**: Modifying core database schemas, authentication flows, or shared utilities that touch many files.
- **Heavy Lift Builds**: Building production-ready bundles that would slow down the browser environment.
- **Full-Stack Verification**: Running tests that require external services (e.g., Docker, PostgreSQL, Redis) that aren't available in WebContainer.

## 2. Spawning a Sandbox
1. Call `security_sandbox` with the relative `scriptPath`, runtime, workspace path, optional `includePaths`, and timeout.
2. Keep execution inside the ephemeral local Docker container.
3. The container must run with `--network none` and clean itself up after completion.
4. Report stdout, stderr, exit code, and timeout state back to the user.

## 3. Local Execution
- Use `security_sandbox` for generated code, test suites, linters, and formatters.
- Use `run_command` only for commands that can run safely in the same local Docker policy.
- Only requested files are copied into the sandbox. Add required non-secret fixtures through `includePaths`; never request `.env`, `.git`, credentials, keys, or token-like files.
- Do not call GitHub Actions, Codespaces, or any cloud runner for validation.

## 4. Resource Limits
- Prefer short timeouts and narrow scripts.
- Keep output concise.
- If Docker is unavailable, report the local environment issue instead of falling back to cloud execution.
