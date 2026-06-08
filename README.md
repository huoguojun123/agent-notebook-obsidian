# Agent Notebook

Agent Notebook is a small Obsidian plugin for building notebook-scoped prompts for CLI agents such as opencode, Codex, or Claude Code.

It does not replace Obsidian, and it does not provide a full chat UI. It helps you turn the current vault, notebook folder, active file, selected text, and task stage into a precise prompt that can be pasted into your preferred CLI agent.

## Features

- Mark a folder as an Agent Notebook.
- Read the current vault, active file, selection, folder, and heading.
- Choose a notebook lifecycle stage: ideate, outline, generate, study, optimize, supplement, or review.
- Generate a structured CLI-agent prompt with scope and edit rules.
- Copy the prompt to the clipboard.
- Optionally create a `_agent-runs/` draft in the notebook folder.

## Install With BRAT

1. Install the Obsidian BRAT plugin.
2. Add this repository as a beta plugin.
3. Enable **Agent Notebook** in Obsidian community plugin settings.

BRAT/release assets are:

- `manifest.json`
- `main.js`
- `styles.css`

## Manual Install

Copy these files into your vault:

```text
.obsidian/plugins/agent-notebook/
```

Required files:

- `manifest.json`
- `main.js`
- `styles.css`

## Development

```bash
pnpm install
pnpm build
```

The source lives in `src/`. The compiled plugin entry is `main.js`.

## Current Status

This is an early MVP intended for personal workflow testing. It generates prompts and run drafts; it does not execute shell commands or call external agents directly.
