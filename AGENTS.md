# AGENTS.md

This file provides guidance to AI agents working with code in this repository.

## Project Overview

D2-vscode is a VS Code extension for the [D2 diagramming language](https://d2lang.com). It provides syntax highlighting, live preview, formatting, theme/layout selection, and markdown rendering for `.d2` files. The extension shells out to the `d2` CLI binary for compilation and formatting — it does **not** include a D2 compiler.

## Architecture

### Core Design Principles

1. **CLI-dependent**: All compilation and formatting delegates to the external `d2` binary via `spawnSync`. The extension never parses or compiles D2 itself.
2. **Singleton modules**: Key objects (`previewGenerator`, `outputChannel`, `taskRunner`, `ws`, `d2Tasks`) are exported as module-level singletons from `extension.ts` and `tasks.ts`.
3. **Document tracking**: Each open `.d2` document gets a `D2P` tracking object that connects it to its preview webview and refresh timer.
4. **VS Code Tasks API**: Compilation runs as a `CustomExecution` task with a `Pseudoterminal`, enabling the `D2Matcher` problem matcher to surface errors in the Problems panel.

### Directory Structure

```
d2-vscode/
├── src/
│   ├── extension.ts             # Entry point — activate(), registers commands, events, markdown renderer
│   ├── docToPreviewGenerator.ts # Singleton: tracks D2P (document→preview) map, orchestrates compilation
│   ├── browserWindow.ts         # WebviewPanel wrapper: renders SVG, handles zoom, link clicks, auxiliary window recovery
│   ├── taskRunner.ts            # Creates CustomExecution tasks with Pseudoterminal for d2 compilation
│   ├── tasks.ts                 # D2Tasks: synchronous compile() and format() via spawnSync to d2 CLI
│   ├── d2BlockFinder.ts         # Pure function: finds ```d2 fenced code blocks in text, returns line ranges + code
│   ├── d2CodeLensProvider.ts    # CodeLensProvider: "View D2 diagram" for ```d2 blocks in markdown files
│   ├── refreshTimer.ts          # Debounce timer for auto-update on keystroke (configurable interval)
│   ├── outputChannel.ts         # D2OutputChannel: timestamped logging to "D2-Output" channel
│   ├── layoutPicker.ts          # QuickPick: dagre, elk, tala (tala only if d2plugin-tala on PATH)
│   ├── themePicker.ts           # QuickPick: 19 themes, NameToThemeNumber() maps name→CLI number
│   ├── utility.ts               # PATH lookup, d2 install check, openWithDefaultApp (cross-platform)
│   └── tsconfig.json            # TypeScript config (ES2020, commonjs, strict)
├── pages/
│   └── previewPage.html         # Webview HTML: zoom controls, drag-to-pan, SVG rendering, state persistence
├── syntaxes/
│   ├── d2.tmLanguage.yaml       # Source of truth for D2 grammar (compiled to JSON via yq)
│   ├── d2.tmLanguage.json       # Generated — do NOT edit directly, edit the .yaml
│   ├── d2-markdown-injection.json # Injects D2 syntax into markdown fenced code blocks
│   └── markdown.tmLanguage.json # D2-flavored markdown for embedded |md blocks
├── themes/
│   ├── dark-color-theme.json    # D2 Dark editor theme
│   └── light-color-theme.json   # D2 Light editor theme
├── test/
│   ├── register.js              # Bootstrap: sets TS_NODE_PROJECT before loading ts-node
│   ├── tsconfig.json            # Test-specific TypeScript config (includes mocha types)
│   ├── runTest.ts               # Integration test launcher (uses @vscode/test-electron)
│   ├── unit/                    # Unit tests (pure logic, no VS Code API dependency)
│   │   ├── d2BlockFinder.test.ts
│   │   └── codeLensMapping.test.ts
│   ├── integration/             # Integration tests (run inside extension host)
│   │   └── index.ts             # Mocha bootstrap for integration test suite
│   ├── import.d2                # Sample .d2 files for manual testing
│   ├── nested.d2
│   └── nested.md
├── language-configuration.json  # Bracket pairs, comments (#, """), indent rules for D2
├── webpack.config.js            # Bundles src/ → dist/extension.js (ts-loader, commonjs2, node target)
├── .mocharc.yml                 # Mocha configuration for unit tests
├── eslint.config.mjs            # ESLint 9 flat config with typescript-eslint + prettier
├── make.sh                      # CI entry point: fmt, lint, build (uses ci/sub submodule)
└── package.json                 # Extension manifest: commands, settings, grammars, themes
```

### Key Data Flow

#### Edit → Preview Flow

```
User edits .d2 file
  ↓
onDidChangeTextDocument fires (extension.ts)
  ↓
RefreshTimer resets (debounces keystrokes, default 1500ms)
  ↓
Timer fires → DocToPreviewGenerator.generate(doc)
  ↓
TaskRunner.genTask() → creates CustomExecution + Pseudoterminal
  ↓
D2Tasks.compile() → spawnSync("d2", [...args, "-"], { input: text })
  ↓
SVG output → BrowserWindow.setSvg() → caches SVG + postMessage to webview
  ↓
Errors → written to Pseudoterminal → D2Matcher problemMatcher → Problems panel
```

#### Save → Preview Flow (updateOnSave mode)

```
User saves .d2 file (manual save only, not auto-save)
  ↓
onWillSaveTextDocument sets hardSave flag
  ↓
onDidSaveTextDocument checks hardSave && updateOnSave setting
  ↓
DocToPreviewGenerator.generate(doc)
```

### Extension Activation & Wiring (extension.ts)

```
1. Register onDidChangeConfiguration listener (re-generate on setting change)
2. Register onDidChangeTextDocument (auto-update via RefreshTimer)
3. Register onWillSaveTextDocument / onDidSaveTextDocument (updateOnSave)
4. Register onDidOpenTextDocument / onDidCloseTextDocument (D2P tracking)
5. Register commands: ShowPreviewWindow, CompileToSvg, PickLayout, PickTheme, ToggleSketch
6. Register DocumentFormattingEditProvider (calls d2Tasks.format)
7. Track already-open .d2 documents
8. Check for d2 install (if checkForInstallAtStart enabled)
9. Return extendMarkdownIt() for markdown code block rendering
```

## VS Code Extension Specifics

### Activation Event

`onStartupFinished` — the extension activates after VS Code finishes startup, regardless of workspace content.

### Registered Commands (6)

| Command                        | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `D2.ShowPreviewWindow`         | Open side-by-side SVG preview (Ctrl+Shift+D)     |
| `D2.CompileToSvg`              | Compile .d2 file to .svg on disk                 |
| `D2.PickTheme`                 | QuickPick to choose preview theme                |
| `D2.PickLayout`                | QuickPick to choose layout engine                |
| `D2.ToggleSketch`              | Toggle sketch rendering mode                     |
| `D2.ViewDiagramFromMarkdown`   | Preview a D2 diagram from a markdown code block  |

### User Settings (D2.\* namespace)

| Setting                     | Type    | Default     | Purpose                                |
| --------------------------- | ------- | ----------- | -------------------------------------- |
| `D2.autoUpdate`             | boolean | `true`      | Auto-update preview on edit            |
| `D2.updateTimer`            | number  | `1500`      | Debounce interval (ms) for auto-update |
| `D2.updateOnSave`           | boolean | `false`     | Update preview on manual save          |
| `D2.previewTheme`           | string  | `"default"` | Theme name for preview rendering       |
| `D2.previewLayout`          | string  | `"dagre"`   | Layout engine (dagre, elk, tala)       |
| `D2.previewSketch`          | boolean | `false`     | Sketch rendering mode                  |
| `D2.execPath`               | string  | `"d2"`      | Path to d2 executable                  |
| `D2.checkForInstallAtStart` | boolean | `true`      | Check for d2 binary on activation      |

### Problem Matcher

`D2Matcher` parses d2 CLI stderr output into VS Code diagnostics. Pattern: `[filepath] err:ErrorType: line:col: message`.

## Build & Development

### Commands

```sh
yarn compile         # webpack build (development)
yarn watch           # webpack watch mode with source maps
yarn package         # webpack production build (used for publishing)
yarn dev             # uninstall → gen grammar → package → install locally
yarn gen             # compile d2.tmLanguage.yaml → d2.tmLanguage.json via yq
yarn pkg             # vsce package → d2.vsix
```

### CI (`make.sh`)

Requires the `ci/sub` git submodule. Runs three parallel jobs:

- **fmt**: Formatting check via `ci/sub/bin/fmt.sh`
- **lint**: ESLint on changed `.ts`/`.tsx`/`.scss`/`.css` files
- **build**: `yarn package`

Initialize submodule first: `git submodule update --init`

### Local Development Workflow

1. Open this repo in VS Code
2. Press F5 → launches Extension Development Host with the extension loaded
3. Edit `.d2` files in the debug instance to test
4. Press Cmd+R / Ctrl+R in debug instance to reload after changes

### Testing

This project uses a **two-tier testing strategy**:

#### Unit Tests (`test/unit/`)

Run with Mocha + ts-node. These test pure logic that has no dependency on the VS Code API.

```sh
npm run test:unit    # Run all unit tests
```

- Tests live in `test/unit/**/*.test.ts`
- Configured via `.mocharc.yml` + `test/register.js` (sets `TS_NODE_PROJECT`)
- Test tsconfig: `test/tsconfig.json` (includes mocha types, separate from src tsconfig)

#### Integration Tests (`test/integration/`)

Run inside a VS Code extension host via `@vscode/test-electron`. These test code that depends on `vscode` APIs.

```sh
npm run test:integration    # Compile + launch extension host tests
```

- Bootstrap: `test/integration/index.ts`
- Launcher: `test/runTest.ts`

#### Running All Tests

```sh
npm test             # Runs unit tests (default)
```

#### Design Principle: Extract Pure Functions for Testability

The singleton architecture and `vscode` API coupling make many modules hard to unit test. When adding new logic, **always extract pure functions into separate modules** (e.g., `d2BlockFinder.ts`) that can be tested without mocking. Keep VS Code API wrappers thin.

Manual testing checklist (in addition to automated tests):

- Open a `.d2` file, verify syntax highlighting
- Ctrl+Shift+D → preview opens with rendered SVG
- Edit `.d2` → preview auto-updates after debounce
- Verify zoom controls (slider, +/-, fit, Ctrl+scroll)
- Right-click → "Compile D2 to SVG" → `.svg` file written
- Pick Theme / Pick Layout from command palette
- Open a `.md` file with ` ```d2 ` fenced blocks → rendered in markdown preview
- Click "View D2 diagram" CodeLens above a ```d2 block in markdown → preview opens
- Toggle sketch mode
- "Move Editor Group into New Window" → preview survives in auxiliary window
- Drag to pan the diagram, verify cursor changes to grabbing
- Pan position persists across zoom changes and state recovery

## Key Dependencies

### Runtime

- **async-mutex**: Mutex for serializing preview generation across multiple documents
- **markdown-it-container**: Enables D2 rendering inside markdown fenced code blocks

### Dev

- **webpack** + **ts-loader**: Bundles TypeScript → `dist/extension.js`
- **TypeScript** 5.6, **ESLint** 9 (flat config + prettier)
- **@vscode/vsce**: Extension packaging
- **mocha** + **ts-node**: Unit test runner with TypeScript support
- **@vscode/test-electron**: Integration test runner (extension host)
- **@types/mocha**: Type definitions for test globals

### External

- **d2 CLI binary**: Must be installed on the user's system and on PATH (or configured via `D2.execPath`). The extension is useless without it.

## Module Responsibilities

| Module                     | What it does                                                      | What it does NOT do                             |
| -------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| `extension.ts`             | Wires everything, holds singleton refs, returns markdownIt plugin | Contain business logic                          |
| `docToPreviewGenerator.ts` | Owns D2P tracking map, mutex-sequenced `generateAll()`            | Compile D2 (delegates to taskRunner)            |
| `browserWindow.ts`         | WebviewPanel lifecycle, SVG caching, auxiliary window recovery, link click handling | Generate SVG                                    |
| `taskRunner.ts`            | Creates VS Code Task + Pseudoterminal for d2 compilation          | Run d2 directly (delegates to d2Tasks)          |
| `tasks.ts`                 | `spawnSync` to d2 CLI for compile and format                      | Manage UI or webviews                           |
| `d2BlockFinder.ts`         | Pure function: finds ```d2 fenced blocks in text, returns ranges + code | Interact with VS Code APIs                      |
| `d2CodeLensProvider.ts`    | CodeLensProvider mapping D2 blocks to "View D2 diagram" lenses    | Compile D2 or manage webviews                   |
| `refreshTimer.ts`          | Debounce keystroke→preview updates                                | Know about D2 or compilation                    |
| `themePicker.ts`           | Theme name↔number mapping, QuickPick UI                           | Apply themes (config update triggers re-render) |
| `layoutPicker.ts`          | Layout QuickPick, detects tala plugin on PATH                     | Apply layouts                                   |
| `utility.ts`               | PATH search, d2 install check, cross-platform file open           | Anything D2-specific                            |

## Common Pitfalls

1. **Don't edit `d2.tmLanguage.json` directly** — it's generated from `d2.tmLanguage.yaml` via `yarn gen` (requires `yq`). Edit the YAML source.
2. **`spawnSync` blocks the extension host** — `D2Tasks.compile()` and `format()` are synchronous. Large diagrams may cause UI freezes. This is the existing design.
3. **Singleton coupling** — Most modules import singletons from `extension.ts` (`ws`, `outputChannel`, `taskRunner`, `previewGenerator`). This makes unit testing difficult. Don't add more singleton cross-references without understanding the existing dependency graph.
4. **WebviewPanel security** — `BrowserWindow` sets `enableScripts: true` and `retainContextWhenHidden: true`. The webview receives SVG directly via `innerHTML`. Any changes to webview content handling must be careful about script injection from malicious `.d2` files.
5. **Auxiliary window recovery** — When a webview is moved to an auxiliary window ("Move Editor Group into New Window"), VS Code destroys and recreates the iframe. Recovery is handled at two levels: (a) `BrowserWindow.lastSvg` cache re-pushed via `onDidChangeViewState`, and (b) webview-side `vscode.getState()`/`setState()` persistence. Both must stay in sync. If you change SVG delivery, update both paths.
6. **Drag-to-pan + zoom transform** — `previewPage.html` applies `translate(panX, panY) scale(...)` as a single CSS transform. `applyTransform()` is the single source of truth for the wrapper's `style.transform`. Do not set `wrapper.style.transform` directly — always go through `applyTransform()` to avoid pan/zoom desync.
7. **Mutex in `DocToPreviewGenerator`** — The `generateAll()` method acquires a mutex per document and releases it via the `onDidEndTask` event. Breaking this flow will deadlock preview generation.
8. **Theme number mapping** — `NameToThemeNumber()` in `themePicker.ts` must stay in sync with the theme enum in `package.json` settings. If D2 adds new themes, both must be updated.
9. **Tala detection** — `layoutPicker.ts` dynamically adds/removes the tala option based on PATH detection at picker creation time, not at activation.
10. **hardSave flag** — The `updateOnSave` flow uses a closure variable `hardSave` to distinguish manual saves from auto-saves. This is fragile — don't refactor save handling without preserving this distinction.
11. **Test-driven development is mandatory** — See the "Test-Driven Development (TDD) Requirements" section below. All new logic must be accompanied by tests. Never skip the Red→Green→Refactor cycle.
12. **`previewPage.html` uses `innerHTML`** — The webview sets `wrapper.innerHTML = message.data` with SVG from the d2 CLI. This is trusted input from a local binary, but be aware of this if the trust model changes.

## Test-Driven Development (TDD) Requirements

**TDD is mandatory for all changes to this repository.** Every new feature, bug fix, or refactor that touches logic must follow the Red→Green→Refactor cycle. No exceptions.

### The TDD Cycle

Every change MUST follow these steps in order:

1. **Red** — Write a failing test FIRST. The test must:
   - Target the specific behavior being added or changed
   - Fail for the right reason (not a syntax error or import failure)
   - Be committed or at least runnable before any implementation begins

2. **Green** — Write the MINIMUM code to make the failing test pass. Do not:
   - Add extra features beyond what the test requires
   - Optimize prematurely
   - Skip running the test suite to confirm green

3. **Refactor** — Clean up the implementation while keeping all tests green. This is the ONLY phase where you restructure code, extract helpers, or improve naming.

4. **Verify** — Run the full test suite (`npm run test:unit`) after every cycle. All tests must pass before moving on.

### What MUST Be Tested

| Change Type | Required Tests |
| --- | --- |
| New pure logic function | Unit tests in `test/unit/` covering normal cases, edge cases, and error cases |
| Bug fix | A regression test that reproduces the bug BEFORE writing the fix |
| New VS Code API integration | Integration test in `test/integration/` if it depends on vscode APIs; extract and unit-test any pure logic separately |
| Refactoring existing code | Ensure existing tests still pass; add tests for any previously untested paths you touch |

### What Does NOT Require Tests

- Purely declarative changes (package.json settings, grammar files, theme JSON)
- Documentation-only changes
- HTML/CSS-only changes to `previewPage.html` (these require manual testing per the checklist)

### How to Write Testable Code

The singleton architecture makes direct unit testing of most modules impossible. Follow these rules:

1. **Extract pure functions** — Any logic that does not require the VS Code API MUST be extracted into a standalone module with no `vscode` imports. Example: `d2BlockFinder.ts` is a pure function that `d2CodeLensProvider.ts` calls. The pure function is unit-tested; the provider is a thin untested wrapper.

2. **Keep VS Code wrappers thin** — Modules that import from `vscode` should contain only wiring/glue code. All decision-making, parsing, transformation, and validation logic belongs in pure modules.

3. **Never add logic to extension.ts** — `extension.ts` is a wiring file. If you need to add behavior, create a new module and register it from `extension.ts`.

4. **Function signatures should accept data, not VS Code objects** — Prefer `function process(text: string)` over `function process(doc: TextDocument)`. This makes the function testable without mocking.

### Test File Conventions

- Unit tests go in `test/unit/<moduleName>.test.ts`
- Integration tests go in `test/integration/<feature>.test.ts`
- Test files must import from `../../src/<module>` (relative paths)
- Use `strict` assert: `import { strict as assert } from "assert"`
- Use descriptive `describe`/`it` blocks that read as specifications
- One `describe` block per module/function under test

### Running Tests

```sh
npm run test:unit           # Run unit tests (fast, no VS Code required)
npm run test:integration    # Run integration tests (launches extension host)
npm test                    # Default: runs unit tests
```

### Enforcement

- **No PR should be merged without tests** for any logic changes
- **Agents must run `npm run test:unit` and confirm all tests pass** before declaring any task complete
- **If you cannot write a test for a change**, explain why in a code comment and add the scenario to the manual testing checklist above
- **Agents that skip the Red phase** (writing implementation before the failing test) are violating this policy — the test must exist and fail before the implementation
