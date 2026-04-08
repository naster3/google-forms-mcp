# Quality Checklist

## Core Behavior

- All tools validate input and fail with stable error codes.
- `create_form` creates a usable empty form and preserves optional description setup.
- Mutation tools work by both `itemId` and `currentIndex` where supported.
- Normalized item output remains stable across releases.
- Errors map cleanly from Google API responses to MCP-friendly error payloads.

## Agent Experience

- Tool descriptions explain when to use each tool.
- Input fields are described in MCP metadata.
- Read tools are marked as read-only.
- Destructive tools are marked as destructive.
- Mutation responses are easy to inspect without reading raw Google API payloads.

## Installation

- A new user can install and authorize in under 10 minutes.
- The auth command clearly tells the user what to do next.
- Build and test commands work on a clean environment.

## Documentation

- README explains the value proposition before the implementation details.
- Setup docs use one package manager consistently.
- Prompt examples match real supported capabilities.
- Troubleshooting covers auth, permissions, indexes, and publishing.

## Release Hygiene

- Package name is understandable and searchable.
- Keywords include MCP and Google Forms terms.
- Version is updated intentionally.
- Changelog or release notes are prepared if behavior changed.
