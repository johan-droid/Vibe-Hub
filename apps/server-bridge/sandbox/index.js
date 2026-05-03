/**
 * Sandbox Module — Offline Code Execution v6
 * ===========================================
 *
 * Provides Docker-based ephemeral testing for generated code.
 * Must run locally with Docker Desktop installed.
 */

export { DockerClient, dockerClient } from './docker-client.js';
export { SandboxTestRunner, CodeValidator, sandboxTestRunner, codeValidator } from './test-runner.js';
