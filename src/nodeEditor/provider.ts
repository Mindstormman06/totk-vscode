import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import { NodeEditorAdapterRegistry } from './registry';

const execPromise = util.promisify(cp.exec);

// --- Python RPC Helpers ---
// Grabs the workspace's configured Python, or defaults to system 'python'
function getCachedPythonExecutable(): string {
    return vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python';
}

// Executes the Python RPC script and parses the JSON response
async function runBridgeJson(pythonExe: string, args: string[]): Promise<any> {
    const extDir = path.join(__dirname, '..', '..'); // Adjust depending on where provider.ts is relative to ainb_rpc.py
    const scriptPath = path.join(extDir, args[0]);   // Assuming args[0] is the script name
    
    // Properly quote arguments to handle spaces and JSON strings in the shell
    const commandArgs = [scriptPath, ...args.slice(1)].map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
    
    const { stdout } = await execPromise(`"${pythonExe}" ${commandArgs}`);
    return JSON.parse(stdout.trim());
}

type NodeEditorMessage =
    | { type: 'ready' }
    | { type: 'requestSaveScaffold' };

const VIEW_TYPE = 'totk-editor.ainbNodeEditor';

export class AinbNodeEditorProvider implements vscode.CustomTextEditorProvider {
    private readonly registry: NodeEditorAdapterRegistry;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Pass the extension path so registry adapters can load internal assets if needed
        this.registry = new NodeEditorAdapterRegistry(context.extensionPath);
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new AinbNodeEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        });
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'editors/node-editor/dist'))],
        };

        const adapter = this.registry.getForUri(document.uri);
        if (!adapter) {
            webviewPanel.webview.html = `<h3>Error: No format adapter registered for ${path.basename(document.uri.fsPath)}</h3>`;
            return;
        }

        webviewPanel.webview.html = this.getWebviewHtml(webviewPanel.webview);

        // Core parsing & dispatch function
        const updateWebview = () => {
            try {
                const result = adapter.parse(document.uri.fsPath, document.getText());
                webviewPanel.webview.postMessage({ type: 'init', payload: result.model });
            } catch (err: any) {
                webviewPanel.webview.postMessage({ type: 'error', payload: { message: err.message } });
            }
        };

        // Message receiver from React App
        webviewPanel.webview.onDidReceiveMessage(async (msg: any) => {
            switch (msg.type) {
                case 'ready':
                    updateWebview();
                    break;
                
                // NEW: Intercept RPC commands from the React UI
                case 'rpc_edit':
                    try {
                        // msg.payload looks like: { action: "link_nodes", payload: { source: 0, target: 1 } }
                        const commandString = JSON.stringify(msg.payload);
                        
                        // Call your Python environment. Assuming runBridgeJson executes a python script:
                        const result = await runBridgeJson(
                            getCachedPythonExecutable(), 
                            ['ainb_rpc.py', '--file', document.uri.fsPath, '--command', commandString]
                        );

                        if (result.status === 'success') {
                            // Python successfully edited the file! 
                            // The VS Code file watcher (onDidChangeTextDocument) will automatically 
                            // trigger updateWebview() because the file changed on disk!
                            vscode.window.showInformationMessage(`Successfully executed: ${msg.payload.action}`);
                        } else {
                            vscode.window.showErrorMessage(`Python Error: ${result.message}`);
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`Failed to run Python API: ${err}`);
                    }
                    break;
            }
        });

        // Watch for raw JSON updates to live-refresh the webview graph
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    private getWebviewHtml(webview: vscode.Webview): string {
        const distDir = path.join(this.context.extensionPath, 'editors', 'node-editor', 'dist');
        const indexPath = path.join(distDir, 'index.html');
        
        if (!fs.existsSync(indexPath)) {
            return `<!DOCTYPE html><html><body><h3>TOTK Node Editor</h3><p>Webview assets missing. Run <code>npm install && npm run build</code> in your React folder.</p></body></html>`;
        }

        let html = fs.readFileSync(indexPath, 'utf-8');
        html = html.replace(/(src|href)="([^"]+)"/g, (_match, attr: string, assetPath: string) => {
            if (assetPath.startsWith('http') || assetPath.startsWith('data:')) {
                return `${attr}="${assetPath}"`;
            }
            const normalized = assetPath.replace(/^\.?\//, ''); // removes leading / or ./
            const diskAsset = path.join(distDir, normalized);
            const webUri = webview.asWebviewUri(vscode.Uri.file(diskAsset));
            return `${attr}="${webUri.toString()}"`;
        });
        
        return html;
    }
}