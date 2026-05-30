import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './logger';
import { runBridgeJsonAsync, runBridgeReadContentAsync } from './bridge';
import { isArchiveFile } from './archives';
import { createDiskDirectory, deleteDiskPath, renameDiskPath } from './diskFsOps';
import { isEditableFile } from './editableFiles';

export interface DiskWriteNotification {
    diskPath: string;
    content: Uint8Array;
    textContent?: string;
}

export class TotkDiskFileSystemProvider implements vscode.FileSystemProvider {
    private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this._onDidChangeFile.event;

    constructor(
        private readonly bridgePath: string,
        private readonly getPython: () => string,
        private readonly getBridgeEnv: () => NodeJS.ProcessEnv,
        private readonly onDidWriteFile?: (info: DiskWriteNotification) => Promise<void>,
    ) {}

    private requirePython(): string {
        const python = this.getPython();
        if (!python) {
            throw new Error(
                'Python environment is not ready. Run "TOTK: Set Up Python Environment" or install Python 3.10+.',
            );
        }
        return python;
    }

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => undefined);
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const diskPath = uri.fsPath;
        if (!fs.existsSync(diskPath)) {
            throw vscode.FileSystemError.FileNotFound(diskPath);
        }

        const stat = fs.statSync(diskPath);
        return {
            type: stat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: stat.ctimeMs,
            mtime: stat.mtimeMs,
            size: stat.size,
        };
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const diskPath = uri.fsPath;
        if (!fs.existsSync(diskPath)) {
            return [];
        }

        return fs.readdirSync(diskPath, { withFileTypes: true }).map((entry) => {
            const entryPath = path.join(diskPath, entry.name);
            if (entry.isDirectory()) {
                return [entry.name, vscode.FileType.Directory];
            }
            if (isArchiveFile(entryPath)) {
                return [entry.name, vscode.FileType.Directory];
            }
            return [entry.name, vscode.FileType.File];
        });
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const diskPath = uri.fsPath;
        logger.info(`totk-disk: Reading file: ${diskPath}`);

        if (!isEditableFile(diskPath)) {
            logger.debug(`totk-disk: Non-editable raw binary file. Reading directly from disk.`);
            return fs.readFileSync(diskPath);
        }

        logger.debug(`totk-disk: Editable file detected. Invoking Python bridge read-disk for processing...`);
        try {
            logger.showProcessingToast(diskPath);
            const content = await runBridgeReadContentAsync(
                this.requirePython(),
                this.bridgePath,
                ['read-disk', diskPath],
                this.getBridgeEnv(),
            );
            logger.debug(`totk-disk: Successfully read and processed file: ${diskPath}`);
            return new TextEncoder().encode(content);
        } catch (error) {
            logger.error(`totk-disk: Failed to read editable file: ${diskPath}`, error as Error);
            const message = error instanceof Error ? error.message : String(error);
            return new TextEncoder().encode(`Error reading file: ${message}`);
        }
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
        const diskPath = uri.fsPath;
        const text = new TextDecoder().decode(content);
        logger.info(`totk-disk: Writing file: ${diskPath} (${content.length} bytes)`);

        if (!isEditableFile(diskPath)) {
            logger.debug(`totk-disk: Non-editable raw binary file. Writing directly to disk.`);
            fs.writeFileSync(diskPath, content);
            logger.showSavedToast(diskPath);
            await this.onDidWriteFile?.({ diskPath, content });
            return;
        }

        if (!fs.existsSync(diskPath)) {
            logger.debug(`totk-disk: File does not exist on disk. Writing directly first.`);
            fs.writeFileSync(diskPath, content);
            logger.showSavedToast(diskPath);
            await this.onDidWriteFile?.({ diskPath, content, textContent: text });
            return;
        }

        logger.debug(`totk-disk: Editable file exists on disk. Invoking Python bridge write-disk...`);
        try {
            logger.showProcessingToast(diskPath);
            await runBridgeJsonAsync<{ success: boolean }>(
                this.requirePython(),
                this.bridgePath,
                ['write-disk', diskPath],
                text,
                this.getBridgeEnv(),
            );
            logger.info(`totk-disk: Successfully wrote and processed file: ${diskPath}`);
            logger.showSavedToast(diskPath);
            await this.onDidWriteFile?.({ diskPath, content, textContent: text });
        } catch (error) {
            logger.error(`totk-disk: Failed to write editable file: ${diskPath}`, error as Error);
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save: ${message}`);
            throw vscode.FileSystemError.Unavailable(message);
        }
    }

    createDirectory(uri: vscode.Uri): void {
        logger.info(`totk-disk: Creating directory: ${uri.fsPath}`);
        createDiskDirectory(uri.fsPath);
        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Created, uri }]);
    }

    delete(uri: vscode.Uri, options: { recursive: boolean }): void {
        logger.info(`totk-disk: Deleting path (recursive=${options.recursive}): ${uri.fsPath}`);
        deleteDiskPath(uri.fsPath, options.recursive);
        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
        logger.info(`totk-disk: Renaming path (overwrite=${options.overwrite}) from: ${oldUri.fsPath} to: ${newUri.fsPath}`);
        renameDiskPath(oldUri.fsPath, newUri.fsPath, options.overwrite);
        this._onDidChangeFile.fire([
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri },
        ]);
    }
}
