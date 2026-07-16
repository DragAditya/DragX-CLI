
<p align="center">
  <a href="https://github.com/DragAditya/DragX-CLI">
    
  </a>
</p>

<h1 align="center">DragX CLI</h1>

<p align="center">
  <strong>Hinglish natural-language CLI for git/GitHub workflows with AI-powered auto-healing.</strong>
</p>

<p align="center">
  <a href="https://github.com/DragAditya/DragX-CLI/actions/workflows/ci.yml">
    <img src="https://github.com/DragAditya/DragX-CLI/actions/workflows/ci.yml/badge.svg" alt="Build Status">
  </a>
  <a href="https://www.npmjs.com/package/dragx-cli">
    <img src="https://img.shields.io/npm/v/dragx-cli?color=blue" alt="npm version">
  </a>
  <a href="https://github.com/DragAditya/DragX-CLI/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT">
  </a>
  <a href="https://github.com/DragAditya/DragX-CLI/issues">
    <img src="https://img.shields.io/github/issues/DragAditya/DragX-CLI" alt="GitHub issues">
  </a>
</p>

---

## 📖 Overview

DragX CLI is an intelligent command-line interface that allows developers to manage their Git and GitHub workflows using natural language, including English, Hindi, and Hinglish (a mix of both). Powered by Google's Gemini AI, DragX understands your intent, generates a step-by-step plan, and executes it, even attempting to auto-heal common errors.

It aims to simplify complex or repetitive Git/GitHub tasks, making them accessible to a broader audience and speeding up development cycles. Whether you want to "add all files and commit", "create a new repo and push", or "purani files delete karo", DragX is designed to understand and act.

### Key Value Proposition

*   **Natural Language Power**: Interact with Git and GitHub using everyday language, including Hinglish.
*   **AI-Driven Automation**: Intelligent planning and execution of multi-step workflows.
*   **Context-Aware**: Understands your project structure, Git status, and existing GitHub remotes.
*   **Safety First**: Confirms destructive actions, offers dry runs, and provides an `undo` mechanism.
*   **Auto-Healing**: Attempts to diagnose and fix common command failures on the fly.
*   **Secure**: Encrypts and stores GitHub authentication tokens locally in your home directory.

### Target Audience

Developers, open-source contributors, and anyone who wants a more intuitive and forgiving way to interact with Git and GitHub, especially those who prefer natural language interfaces.

### Current Status

DragX CLI is currently at version `1.0.0`. It is stable for core Git and GitHub operations and actively being developed with new features planned.

## ✨ Features

*   **Natural Language Processing**:
    *   Understands commands in English, Hindi, and Hinglish.
    *   Converts natural language into structured, executable plans.
*   **Intelligent Plan Generation**:
    *   Generates a human-readable summary of actions.
    *   Provides a confidence score for its interpretation.
    *   Asks for clarification on ambiguous or risky requests.
    *   Includes all necessary prerequisite steps (e.g., `git init` if no repo exists).
*   **Context Awareness**:
    *   Scans the current directory for project type (Node.js, Python, etc.) and manifest files.
    *   Reads `git status` and existing remotes to inform decisions.
    *   Excludes `.dragx/` folder from Git operations automatically.
*   **Git Workflow Automation**:
    *   `add`: Stage files.
    *   `commit`: Create commits with AI-generated or user-specified messages.
    *   `push`: Push changes to remote repositories.
    *   `branch`: Manage branches.
    *   `delete`: Remove files or directories.
    *   `rename`: Rename files or directories.
    *   And many more common Git commands.
*   **GitHub Integration**:
    *   `create_remote_repo`: Create new GitHub repositories directly.
    *   `pr`: Create pull requests (planned).
    *   Secure authentication and token storage.
*   **Safety & Undo Mechanisms**:
    *   **Destructive Action Confirmation**: Prompts for confirmation before executing commands that delete, overwrite, or force-push.
    *   **Dry Run Mode**: Preview the generated plan without execution using `--dry-run`.
    *   **Snapshot & Undo**: Creates snapshots before destructive actions, allowing you to `dragx undo` the last operation.
*   **Auto-Healing**:
    *   Detects common command failures (e.g., missing tools, incorrect setup).
    *   Asks AI for a suggested fix command.
    *   Confirms with the user before applying the fix.
    *   Retries the original command after a successful fix.

## 🚀 Tech Stack

*   **Language**: JavaScript (Node.js)
*   **AI Model**: Google Gemini (primarily `gemini-3.1-flash-lite`, with `gemini-3-flash` as fallback) via `@google/genai`
*   **CLI Framework**: `commander.js`
*   **Interactive Prompts**: `inquirer.js`
*   **Terminal Styling**: `chalk`, `boxen`, `ora` (for spinners)
*   **Core Dependencies**:
    *   `@google/genai`: For AI model interaction.
    *   `boxen`: For drawing boxes in the terminal.
    *   `chalk`: For terminal string styling.
    *   `commander`: For parsing command-line arguments.
    *   `inquirer`: For interactive user prompts.
    *   `ora`: For elegant terminal spinners.
*   **Node.js Version**: `>=18`

## 🏛️ Architecture

DragX CLI follows a modular architecture designed for clarity, maintainability, and extensibility.

```
.
├── bin/
│   └── dragx.js          # CLI entry point, parses user input
├── src/
│   ├── ai/               # AI client, prompt engineering
│   ├── context/          # Gathers project context (file tree, git status, project type)
│   ├── core/             # Core logic: chat, intent routing, planning, execution
│   ├── github/           # GitHub API interactions (auth, repo creation, PRs)
│   ├── safety/           # Confirmation, dry run, undo snapshots
│   └── utils/            # Logging, error handling, auto-fix suggestions
└── test/                 # Unit and integration tests
```

### High-Level Flow

1.  **User Input**: The user invokes `dragx` with a natural language command.
2.  **CLI Entry (`bin/dragx.js`)**: Parses the command and options.
3.  **Context Gathering (`src/context/`)**: Scans the current project for relevant information (file structure, `git status`, `package.json`, `README.md`, etc.).
4.  **AI Interaction (`src/ai/`)**:
    *   Combines user input with system prompts and project context.
    *   Sends the full prompt to the Google Gemini AI model.
    *   Receives a raw JSON response from the AI.
5.  **Plan Generation (`src/core/planner.js`)**:
    *   Parses and validates the AI's JSON response into a structured execution plan.
    *   Adds extra safety checks (e.g., flags suspicious commands as destructive).
6.  **Execution (`src/core/executor.js`)**:
    *   Iterates through each step of the plan.
    *   Prompts for confirmation on destructive steps, creating undo snapshots.
    *   Executes shell commands or interacts with GitHub API (`src/github/`).
    *   On failure, triggers auto-healing (`src/utils/errorHandler.js`) by asking the AI for a fix.
    *   Logs progress and results.

## 🏁 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: Version 18 or higher. You can download it from [nodejs.org](https://nodejs.org/).
*   **Git**: The Git command-line tool. Download from [git-scm.com](https://git-scm.com/).
*   **Google Gemini API Key**: You'll need an API key for Google's Gemini models. Get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation

Install DragX CLI globally using npm:

```bash
npm install -g dragx-cli
```

### Configuration

#### 1. Gemini API Key

DragX needs your Google Gemini API key to function. Set it as an environment variable `GEMINI_API_KEY`.

You can do this in a few ways:

*   **Temporary (for current session)**:
    ```bash
    export GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```
*   **Project-local `.env` file**: Create a file named `.env` in your project's root directory:
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```
*   **Global `.env` file**: Create a file named `~/.dragx/.env` in your home directory:
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```
    (This is useful if you want to use the same key across multiple projects without setting it for each one.)

#### 2. GitHub Authentication

To perform GitHub actions like creating repositories or pull requests, DragX needs to authenticate with your GitHub account.

Run the following command:

```bash
dragx auth login
```

This will guide you through the GitHub authentication process, securely storing an encrypted token in your home directory (`~/.dragx/auth.enc`).

To log out:

```bash
dragx auth logout
```

## 💡 Usage

Once installed and configured, you can start using DragX with natural language commands.

### Basic Commands

```bash
# Add all changes and commit with a descriptive message
dragx "add all files and commit with message 'feat: initial project setup'"

# Create a new GitHub repository and push your current branch
dragx "create a new github repository and push my code"

# Delete old configuration files (DragX will ask for clarification if ambiguous)
dragx "delete purani config files"

# Stage specific files
dragx "add src/index.js and package.json"

# Commit staged changes
dragx "commit changes"

# Push current branch to origin
dragx "push my code"

# Undo the last destructive action (e.g., a deletion or a force push)
dragx undo

# Get help for your project (e.g., how to run tests)
dragx "how do I run tests in this project?"
```

### Dry Run

Always use the `--dry-run` flag to preview the plan before executing any commands, especially for critical or destructive operations.

```bash
dragx "delete all files in the 'dist' folder" --dry-run
```

This will show you the JSON plan DragX intends to execute without actually running any commands.

### Interactive Confirmation

For any potentially destructive command (e.g., `rm`, `git reset --hard`, `git push -f`), DragX will explicitly ask for your confirmation before proceeding.

```bash
dragx "delete the 'node_modules' folder"
```

```
⚠ Destructive action: rm -rf node_modules
Are you sure you want to run this step? (y/N)
```

### Project Help

DragX can analyze your project's `package.json`, `README.md`, or other manifest files to provide context-aware help.

```bash
dragx "how do I run the project?"
```

## 🛠️ Development

If you want to contribute to DragX CLI or run it locally for development:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/DragAditya/DragX-CLI.git
    cd DragX-CLI
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run locally**:
    You can use `npm start` to run the CLI directly from the source:
    ```bash
    npm start -- "add all files"
    ```
    Or, link it globally for easier testing:
    ```bash
    npm link
    # Now you can use 'dragx' directly
    dragx "commit with message 'test commit'"
    ```
4.  **Run tests**:
    ```bash
    npm test
    ```

### Code Style

Follow standard JavaScript practices. The project uses ESM modules.

### Debugging

You can use Node.js's built-in debugger. For example:

```bash
node --inspect-brk bin/dragx.js "add all files"
```

Then open `chrome://inspect` in your Chrome browser to attach the debugger.

## 🚀 Deployment

DragX CLI is primarily distributed via npm. To publish a new version:

1.  Update the `version` in `package.json`.
2.  Ensure all tests pass.
3.  Run `npm publish`.

## 🤝 Contributing

We welcome contributions to DragX CLI! Here's how you can help:

1.  **Fork the repository**.
2.  **Clone your forked repository**: `git clone https://github.com/YOUR_USERNAME/DragX-CLI.git`
3.  **Create a new branch**: `git checkout -b feature/your-feature-name`
4.  **Make your changes**.
5.  **Run tests**: `npm test`
6.  **Commit your changes**: Write clear, concise commit messages.
7.  **Push to your branch**: `git push origin feature/your-feature-name`
8.  **Open a Pull Request**: Describe your changes and the problem they solve.

### Development Workflow

*   **Feature Branches**: All new features and bug fixes should be developed in separate branches.
*   **Pull Requests**: Submit pull requests to the `main` branch.
*   **Code Review**: All pull requests will be reviewed before merging.

## ⁉️ Troubleshooting

*   **`GEMINI_API_KEY not found`**: Ensure you have set your `GEMINI_API_KEY` environment variable or created a `.env` file as described in the [Configuration](#configuration) section.
*   **GitHub Authentication Issues**: If you're having trouble with GitHub actions, try running `dragx auth login` again.
*   **AI Response Errors**: If DragX struggles to understand your command or parse the AI's response, try rephrasing your command more clearly.
*   **Command Failures**: DragX will attempt to auto-heal failed commands. If it can't, the error message will be displayed. Check the error output and consider opening an issue.
*   **Where to get help**: If you encounter persistent issues, please open an issue on the [GitHub Issues page](https://github.com/DragAditya/DragX-CLI/issues).

## 🗺️ Roadmap

*   **Enhanced GitHub Integration**:
    *   Support for creating pull requests (`dragx pr`).
    *   Listing repositories, issues, etc.
*   **More Git Commands**: Expand coverage for advanced Git operations (rebase, cherry-pick, reflog).
*   **Improved Context Awareness**: Deeper understanding of project-specific configurations and build tools.
*   **Plugin System**: Allow users to extend DragX with custom actions or integrations.
*   **Interactive Mode**: A persistent chat mode for multi-turn conversations.
*   **Multi-language Support**: Expand beyond Hinglish to other languages.

## 📄 License & Credits

This project is licensed under the MIT License. See the [LICENSE](https://github.com/DragAditya/DragX-CLI/blob/main/LICENSE) file for details.

### Contributors

*   [DragAditya](https://github.com/DragAditya) - Initial work & maintainer

### Acknowledgments

*   Thanks to the developers of `commander.js`, `inquirer.js`, `chalk`, `ora`, and `boxen` for their excellent libraries.
*   Powered by [Google Gemini](https://ai.google.dev/).
```
