# Copilot Instructions for wifisentry

## Repository Overview

This repository defines reusable GitHub Actions workflows and Gemini CLI command configurations for automated issue triage, pull request review, and other AI-assisted tasks. It provides reference implementations for integrating Google's Gemini CLI into GitHub workflows.

## Architecture

The repository follows a modular structure with two main components:

1. **Workflows** (`.github/workflows/`) - Reusable workflow files that orchestrate:
   - `gemini-triage.yml` - Analyzes issues and applies labels based on content
   - `gemini-review.yml` - Reviews pull requests using Gemini CLI
   - `gemini-invoke.yml` - Generic invocation point for Gemini CLI tasks
   - `gemini-dispatch.yml` - Handles workflow dispatch events
   - `gemini-scheduled-triage.yml` - Runs triage on a schedule

2. **Command Definitions** (`.github/commands/`) - TOML files that define the AI assistant prompts and behavior:
   - Maps to corresponding workflow files
   - Contains the actual prompt/role definition passed to Gemini CLI
   - Example: `gemini-triage.toml` defines the triage assistant behavior

## Key Conventions & Patterns

### Workflow Security
- **No authentication tokens in environment variables** - Set `GITHUB_TOKEN: ''` when running on untrusted inputs to prevent token leakage in logs
- **GitHub App tokens** - Use `actions/create-github-app-token` to mint identity tokens with scoped permissions for sensitive operations
- **Label validation** - The label application step validates selected labels against available labels to prevent injection attacks

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
  - `gemini-review.yml` includes: `add_comment_to_pending_review`, `pull_request_read`, `pull_request_review_write`
  - `gemini-invoke.yml` includes broader tools: issue operations, PR operations, file operations, code search
  - When adding new MCP server tools, verify Docker image availability and pass required credentials
  
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
