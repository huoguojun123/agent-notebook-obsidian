# Agent Notebook

Agent Notebook is a small Obsidian plugin for building notebook-scoped prompts for CLI agents such as opencode, Codex, or Claude Code.

It does not replace Obsidian, and it does not provide a full chat UI. Obsidian remains the place to read and organize notes; the CLI agent remains the place to execute work. This plugin turns the current vault, notebook folder, active file, heading, selected text, task stage, scope, and edit policy into a precise prompt that can be pasted into your preferred CLI agent.

## Features

- Open a right sidebar Agent Notebook panel.
- Mark a folder as an Agent Notebook.
- Read the current vault, active file, selected text, folder, and heading.
- Choose a notebook lifecycle stage: ideate, outline, generate, study, optimize, supplement, or review.
- Choose task scope: current selection, current heading, current file, or whole notebook.
- Choose how non-focus content should be handled: suggest only, ask first, or allow linked edits.
- Generate a structured CLI-agent prompt with scope and edit rules.
- Copy the prompt to the clipboard.
- Optionally create a `_agent-runs/` draft in the notebook folder.

## Workflow

1. Open a Markdown note in Obsidian.
2. Use the ribbon icon or command palette to open **Agent Notebook**.
3. Mark the current folder as a notebook if needed.
4. Select the stage, scope, and non-focus policy.
5. Write the task requirement.
6. Copy the generated prompt, paste it into your CLI agent, and let Obsidian remain the reading surface.

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
