# Changelog

## Unreleased

### Added

- **Drag-to-pan**: Click and drag to pan the diagram in the preview window. Pan position is preserved across zoom changes and webview state recovery.
- **Auxiliary window support**: Preview now survives being moved to an auxiliary window via "Move Editor Group into New Window". The extension caches the last rendered SVG and re-sends it when the webview regains visibility. The webview also persists its own state via `vscode.getState()`/`setState()` as a secondary recovery path.

### Fixed

- Clicking on a non-link area in the preview no longer throws an error (added null guard on `closest("a[href]")`).
