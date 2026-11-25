# Changelog

## 0.2.0

- Redesign the reader UI for calm reading flow: iconized top toolbar, ghost/neutral actions, color-coded annotation cards with hover actions, collapsible filter drawer, export menu, dark-theme adaptive canvas, warm/dark paper appearance modes, and a draggable side panel that turns into a slide-over drawer on narrow viewports.
- Add full-text PDF search (`Cmd/Ctrl + F`) with match highlights and a filterable table of contents (outline) panel.
- Support opening multiple PDFs side-by-side (`PaperReaderPanel` per-document registry) and platform-aware shortcuts (`⌘` / `⌥` on macOS, `Ctrl` / `Alt` elsewhere), plus a 1-click toolbar box-select toggle for formulas and figures.
- Enhance AI workflow and selection quality: add `Copy for AI` with paper/page/context citations, optional `.inleaf-reader/active-context.json` focus sync, smart CJK/English text joining, hyphenation healing, 1-click swatch highlighting, inline tags in new notes, and a 20-step undo delete stack.
- Add a generic OpenAI-Compatible translation provider (with presets for OpenAI, DeepSeek, local keyless Ollama, and OpenRouter), expand the Wordbook with real context sentences, jump-to-page badges, editable notes, search, and Markdown/Anki CSV export, and localize the UI automatically between English and Simplified Chinese.

## 0.1.4

- Fix the selection shade flashing across the whole page when quickly dragging
  over English words or numbers (#7).
- Size the selection toolbar to the enabled actions instead of leaving room
  for disabled ones (#7).
- Show "Show in panel" unchecked while a capability is disabled; the saved
  preference returns when it is re-enabled.

## 0.1.3

- Keep the reader scrollbar visible and refine annotation interactions.
- Preserve text selection over highlights and unify the selection color.
- Add Chinese README and language navigation.

## 0.1.0

- Initial public release: in-editor PDF reading with highlights, annotations,
  portable AI-ready notes, offline dictionary (ECDICT), and translation.
