# Play Hub Engineering Guide

This repository is independently managed and is not connected to a hosted code-generation service.

## Principles

- Keep game rules deterministic and testable.
- Keep game-specific rules separate from platform concerns.
- Never trust client-controlled competitive scores or winners.
- Keep authentication separate from game logic.
- Prefer server-authoritative actions for ranked multiplayer.
