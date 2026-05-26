import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';

let db: Database | undefined;
let loadedDbPath: string | undefined;
let loadedRoot: string | undefined;
let extensionPath: string | undefined;

export function setExtensionPath(extPath: string): void {
    extensionPath = extPath;
}

function getWasmPath(): string | undefined {
    const candidates: string[] = [];
    if (extensionPath) {
        candidates.push(path.join(extensionPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'));
    }
    try {
        const sqlJsDir = path.dirname(require.resolve('sql.js'));
        candidates.push(path.join(sqlJsDir, 'dist', 'sql-wasm.wasm'));
        candidates.push(path.join(sqlJsDir, 'sql-wasm.wasm'));
    } catch {
        // fall through
    }
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

async function openDb(dbPath: string): Promise<Database | undefined> {
    if (!fs.existsSync(dbPath)) {
        return undefined;
    }

    if (loadedDbPath === dbPath && db) {
        return db;
    }

    closeDb();

    const wasmBinary = getWasmPath();
    const initOpts: Parameters<typeof initSqlJs>[0] = {};
    if (wasmBinary) {
        initOpts.locateFile = () => wasmBinary;
    }
    const SQL = await initSqlJs(initOpts);
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    loadedDbPath = dbPath;

    const rootResult = db.exec("SELECT value FROM meta WHERE key = 'root'");
    loadedRoot = rootResult[0]?.values?.[0]?.[0] as string | undefined;
    return db;
}

function closeDb(): void {
    if (db) {
        db.close();
        db = undefined;
        loadedDbPath = undefined;
        loadedRoot = undefined;
    }
}

export interface RomfsIndexResult {
    matchedFiles: Set<string>;
    matchedDirs: Set<string>;
}

export async function queryRomfsIndex(
    dbPath: string,
    romfsPath: string,
    needle: string,
): Promise<RomfsIndexResult | undefined> {
    if (!needle) {
        return undefined;
    }

    const database = await openDb(dbPath);
    if (!database || !loadedRoot) {
        return undefined;
    }

    const normalizedRomfs = romfsPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    if (loadedRoot !== normalizedRomfs) {
        return undefined;
    }

    const stmt = database.prepare('SELECT path FROM files WHERE path LIKE :pattern');
    stmt.bind({ ':pattern': `%${needle}%` });

    const files = new Set<string>();
    const dirs = new Set<string>();

    while (stmt.step()) {
        const row = stmt.get();
        const filePath = row[0] as string;

        const fileName = filePath.split('/').pop() ?? '';
        if (!fileName.includes(needle)) {
            continue;
        }

        files.add(filePath);

        let cursor = filePath.lastIndexOf('/');
        while (cursor > 0) {
            const parent = filePath.slice(0, cursor);
            if (dirs.has(parent)) {
                break;
            }
            dirs.add(parent);
            cursor = parent.lastIndexOf('/');
        }
    }
    stmt.free();

    return { matchedFiles: files, matchedDirs: dirs };
}

export function invalidateRomfsIndex(): void {
    closeDb();
}
