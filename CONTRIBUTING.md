# Contributing to Selina

First off, thank you for considering contributing to Selina! It's people like you that make Selina such a powerful autonomous AI coding assistant.

This document provides guidelines and instructions for contributing to this repository. Please read it carefully before submitting a pull request or opening an issue.

## 🤝 How Can I Contribute?

### 🐛 Reporting Bugs
This section guides you through submitting a bug report for Selina. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Check Existing Issues:** Before submitting a new bug report, please check the [Issue Tracker](https://github.com/your-org/selina/issues) to see if the problem has already been reported.
- **Use a Clear Title:** Give the issue a descriptive title.
- **Provide Context:** Describe the environment where the bug occurred (e.g., OS version, Node.js version, LLM provider).
- **Steps to Reproduce:** Provide a clear, step-by-step process to reproduce the bug.
- **Expected Behavior:** Describe what you expected to happen.
- **Actual Behavior:** Describe what actually happened, including screenshots or console logs if possible.

### 💡 Requesting Features
We welcome feature requests!

- **Check Existing Ideas:** Verify that a similar request doesn't already exist.
- **Explain the "Why":** Explain the problem the feature would solve and how it aligns with Selina's goal as an autonomous MOE coding agent.
- **Propose a Solution:** Provide a detailed description of how the feature could work, including API design or UI sketches if relevant.

### 💻 Submitting Pull Requests
The core of open source! We welcome your patches, whether they are small typo fixes or major architectural additions.

1. **Fork the Repository:** Fork the `selina` repository to your own GitHub account.
2. **Create a Branch:** Create a branch for your work (`git checkout -b feature/your-feature-name`).
3. **Make Your Changes:** Implement your feature or bug fix.
4. **Follow the Style Guide:** Ensure your code matches the existing style.
5. **Add Tests:** If adding a new feature or fixing a bug, include relevant tests (Vitest for backend, Playwright for E2E).
6. **Run Validations:** Ensure all tests pass by running `npm run validate` or `npx vitest run`.
7. **Commit Semantically:** Use semantic commit messages (e.g., `feat: added new provider`, `fix: resolved race condition in VFS`).
8. **Push to Your Branch:** Push your changes to your fork (`git push origin feature/your-feature-name`).
9. **Open a Pull Request:** Open a PR against the `main` branch of the official Selina repository. Fill out the PR template thoroughly.

## 🛠 Development Environment

To set up a local development environment, please refer to the "Getting Started" section in the [README.md](README.md).

### Architecture Rules
When contributing, please be mindful of Selina's architecture:
- **Isolation:** Changes inside the Virtual File System (VFS) must go through the user approval process. Do not bypass the sandbox or the human-in-the-loop gate unless explicitly designing a zero-touch agent mode.
- **Security:** Do not log sensitive data (like API keys or tokens). Use the centralized `logger` utility.

## 📝 Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

We look forward to building the ultimate AI coding agent together!
