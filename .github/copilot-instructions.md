# Copilot Instructions for wifisentry

## Quick Start for Copilot Sessions

This repository includes GitHub MCP Server configuration (`.github/mcp.json`) that's automatically loaded when Copilot CLI starts. The MCP server provides direct access to:
- Repository workflows, branches, and commits
- GitHub Issues and Pull Requests
- Code search and repository content
- Workflow run logs and telemetry

To enable it in your session, use: `/mcp show` or `/mcp enable github` (if previously disabled)

## Repository Overview

This repository defines reusable GitHub Actions workflows and Gemini CLI command configurations for automated issue triage, pull request review, and other AI-assisted tasks. It provides reference implementations for integrating Google's Gemini CLI into GitHub workflows.

## Architecture

The repository follows a modular structure with two main components:

1. **Workflows** (`.github/workflows/`) - Reusable workflow files (using `on: workflow_call`) that orchestrate:
   - `gemini-triage.yml` - Analyzes issues and applies labels; called on issue creation/update
   - `gemini-review.yml` - Reviews pull requests using Gemini CLI with GitHub MCP Server access
   - `gemini-invoke.yml` - General-purpose AI agent for repository tasks; includes manual approval step before execution
   - `gemini-dispatch.yml` - Event router that listens for PR/issue events and commands
   - `gemini-scheduled-triage.yml` - Runs batch triage on schedule with pagination for large issue counts

   **Note**: All core workflows are reusable (`workflow_call`), allowing other repos/workflows to invoke them by reference.

2. **Command Definitions** (`.github/commands/`) - TOML files that define the AI assistant prompts and behavior:
   - Maps to corresponding workflow files (e.g., `gemini-triage.toml` ↔ `gemini-triage.yml`)
   - Contains the system prompt (role, guidelines, instructions) passed to Gemini CLI
   - Supports environment variable substitution using `!{echo $VARIABLE_NAME}` syntax
   - Output instructions tell the AI how to write results to `GITHUB_ENV` for subsequent steps

## Key Conventions & Patterns

### Concurrency Strategy
- **Triage & Review workflows** use `cancel-in-progress: true` - If multiple triage/review events are triggered, the latest one cancels previous runs
- **Invoke workflow** uses `cancel-in-progress: false` - Executes sequentially to preserve order of AI-driven changes (important for file modifications that might conflict)
- Group IDs use `github.event.pull_request.number || github.event.issue.number` to prevent crosstalk between different PRs/issues

### Workflow Security
- **No authentication tokens in environment variables** - Set `GITHUB_TOKEN: ''` when running on untrusted inputs to prevent token leakage in logs
- **GitHub App tokens** - Use `actions/create-github-app-token` to mint identity tokens with scoped permissions for sensitive operations
- **Label validation** - The label application step validates selected labels against available labels to prevent injection attacks
- **Shell tool restrictions** - Only `echo` is enabled for triage/review; `gemini-invoke` enables `cat`, `echo`, `grep`, `head`, `tail` (no command substitution operators allowed)

### AI Approval Workflow (gemini-invoke)
- Two-step execution: (1) AI generates a plan/code suggestion, (2) human review before applying
- The AI proposes changes and writes them to environment variables or workflow artifacts
- A manual approval step validates the proposed changes before committing/pushing
- Implements least-privilege principle: approval step creates separate credentials with minimal needed permissions

### Gemini CLI Integration
- Workflows use `google-github-actions/run-gemini-cli@v0` action with specific settings:
  - `maxSessionTurns: 25` - Limits AI conversation depth
  - `telemetry.enabled: true` - Captures execution telemetry to `.gemini/telemetry.log`
  - Restricted tool access via `"tools.core": ["run_shell_command(echo)"]` where appropriate
  - MCP servers configured via `mcpServers` in settings (e.g., GitHub MCP Server in Docker)

### MCP Server Configuration
- **GitHub MCP Server** (used in `gemini-review.yml` and `gemini-invoke.yml`):
  - Runs in Docker: `ghcr.io/github/github-mcp-server:v0.27.0`
  - Requires `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable (passed from `GITHUB_TOKEN`)
  - **gemini-review.yml** tools: `add_comment_to_pending_review`, `pull_request_read`, `pull_request_review_write` (read PR, write reviews only)
  - **gemini-invoke.yml** tools: broader access for `issue_read`, `issue_write`, `pull_request_read`, `pull_request_write`, `repository_read`, `pull_request_create`, `file_read`, `code_search` (allows creating/modifying PRs and issues)
  - When adding new MCP server tools, verify Docker image availability, confirm tool names match the server implementation, and ensure required credentials are passed
  - Environment substitution in settings uses `${GITHUB_TOKEN}` syntax (not `!{echo}`)
  
### Command Prompts (TOML Files)
- Define the AI assistant's role, guidelines, and step-by-step instructions
- Use environment variable substitution with `!{echo $VARIABLE_NAME}` syntax
- Include explicit security constraints (e.g., forbidding command substitution `$(...)`, `<(...)`, `>(...)`)
- Convert outputs to comma-separated values (CSV) and append to GitHub environment files

### Environment Management
- Workflows output results via `GITHUB_ENV` (typically `/tmp/runner/env`)
- Selected results (e.g., `SELECTED_LABELS`) are parsed in subsequent steps for action
- Pagination is used for large API responses (e.g., label fetching uses `per_page: 100`)

## Variable & Secret Configuration

Required repository variables and secrets for Gemini workflows:
- **Variables**: `GOOGLE_CLOUD_LOCATION`, `GOOGLE_CLOUD_PROJECT`, `SERVICE_ACCOUNT_EMAIL`, `GCP_WIF_PROVIDER`, `GEMINI_CLI_VERSION`, `GEMINI_MODEL`, `GOOGLE_GENAI_USE_GCA`, `GOOGLE_GENAI_USE_VERTEXAI`, `UPLOAD_ARTIFACTS`, `APP_ID` (optional, for GitHub App auth)
- **Secrets**: `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `APP_PRIVATE_KEY` (if using GitHub App)

## Making Changes

When modifying workflows:
1. Update the corresponding `.github/workflows/*.yml` file
2. If changing AI behavior, update the matching `.github/commands/*.toml` prompt
3. Test using workflow dispatch or manual trigger before committing
4. Ensure security constraints are maintained (no token leakage, validated outputs)
5. Verify variable/secret references match configured repository settings

When updating TOML prompts:
- Maintain consistent role definitions and output format (CSV)
- Update guidelines section with any new constraints
- Test with sample inputs to verify expected output behavior
- Pay special attention to environment variable substitution syntax: `!{echo $VARIABLE_NAME}`
- Ensure all security directives are maintained (no command substitution, no token exposure)

### Testing Workflows Locally

Since workflows run on GitHub Actions, use these approaches to test changes:
- Use workflow dispatch triggers (configured in dispatcher workflows) to run on demand
- Add debug output to steps to verify variables and outputs are correct
- Enable `GEMINI_DEBUG` variable for verbose Gemini CLI output
- Check `.gemini/telemetry.log` artifacts for execution details
- Validate TOML syntax using a TOML validator before committing

## Common Workflow Modifications

### Adding a new issue classification workflow
1. Create `.github/workflows/gemini-new-task.yml` with `workflow_call` trigger
2. Create `.github/commands/gemini-new-task.toml` with the AI role and instructions
3. Reference it in `gemini-dispatch.yml` to trigger on specific commands or events
4. Ensure the TOML includes security constraints and clear output format instructions

### Expanding MCP Server access
1. Update the `includeTools` array in the `mcpServers.github` section of the settings JSON
2. Test the new tool by manually running the workflow with `GEMINI_DEBUG: true`
3. Verify tool names match the GitHub MCP Server implementation
4. Document the new tool access requirement in this file

### Debugging AI output
- AI responses are written to `GITHUB_ENV` as CSV or JSON, parsed in subsequent workflow steps
- If the AI's output doesn't parse correctly, check the telemetry log (`.gemini/telemetry.log`) for the full AI conversation
- Use `actions/upload-artifact` to save telemetry logs for inspection if the workflow fails
