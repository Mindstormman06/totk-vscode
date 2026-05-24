# totk-vscode

VS Code support for editing **Tears of the Kingdom** modding files inside decompressed game data.

## Features

- Customizable syntax colors for BYML / BGYML / MSBT (Settings → **TOTK Editor**)
- Browse `.pack` / `.sarc` archives (including `.zs` compressed) as folders
- Edit `.byml` / `.bgyml` as text
- Edit `.msbt` message files as `label: text` lines
- Syntax highlighting for BYML-style text and MSBT labels (including numeric IDs)

You need **decompressed** romfs/data on disk (not ROM or single compressed archives at the workspace root without extraction).

## Install and use

1. Install the extension (VSIX or Marketplace).
2. On first activation, the extension creates a private Python virtual environment and installs `oead`, `zstandard`, and `pymsbt` automatically.
3. **Requirement:** [Python 3.10+](https://www.python.org/downloads/) must be installed and discoverable (`python` / `python3` on PATH, or Windows `py` launcher).
4. Open a folder that contains your extracted game files, or run **TOTK: Open SARC Archive**.

If setup fails, run **TOTK: Set Up Python Environment** from the Command Palette, or set `totk-editor.pythonPath` to your `python.exe`.

## Syntax colors

Open Settings and search **TOTK Editor**. Each token type has a color picker:

| Setting | What it colors |
|--------|----------------|
| `colors.tag` | Keys / labels (before `:`) |
| `colors.string` | String values |
| `colors.number` | Numbers |
| `colors.boolean` | `true`, `false`, `null` |
| `colors.punctuation` | `:`, list `-` |
| `colors.msbtCommand` | `{cmd:...}` tags in MSBT |
| `colors.comment` | `#` comments |

Turn off **Colors: Enabled** to stop applying TOTK colors. Use **TOTK: Reset Syntax Colors to Defaults** to restore the built-in palette.

## Bundle and share (`.vsix`)

A VSIX file is the installable extension package. Build it from the project root:

```bash
npm install
npm run package:vsix
```

That produces `totk-vscode-0.0.1.vsix` (version comes from `package.json`). Send that file to anyone using VS Code or Cursor.

**Install on another machine**

1. Install [Python 3.10+](https://www.python.org/downloads/) (add to PATH on Windows).
2. In VS Code / Cursor: Extensions view → `...` menu → **Install from VSIX...** → pick the `.vsix` file.
3. Reload the window when prompted.
4. First run will download Python libraries into a private venv (one-time setup notification).

**Share via GitHub**

- Attach the `.vsix` to a [Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) tag (e.g. `v0.0.1`).
- Put install steps in the release notes (Python required, Install from VSIX).

**Publish to the Marketplace (optional)**

1. Create a [publisher](https://marketplace.visualstudio.com/manage) on the Visual Studio Marketplace.
2. Add to `package.json`: `"publisher": "your-publisher-id"` and bump `"version"` for each release.
3. Create a [Personal Access Token](https://dev.azure.com/) with Marketplace **Manage** scope.
4. Run: `npx vsce login your-publisher-id` then `npm run package:vsix` and `npx vsce publish`.

Users can then install by name from the Extensions panel without a VSIX file.

## Publishing checklist (maintainers)

- Run `npm run package:vsix` so `dist/extension.js` is built before packaging.
- Ship `totk_bridge.py`, `byml_editor_format.py`, `msbt_editor_format.py`, and `requirements.txt` (included in the VSIX by default).
- Do **not** add `*.py` to `.vscodeignore`.
- Test a clean machine: install only the VSIX + Python, no manual `pip install`.

## Development

```bash
npm install
npm run compile
```

Press F5 to launch the Extension Development Host. The dev host uses the same auto-setup logic as production.

Manual Python setup (optional):

```bash
py -3.12 -m pip install -r requirements.txt
```
