declare module 'sql.js' {
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
    }

    interface Database {
        exec(sql: string, params?: unknown[]): QueryExecResult[];
        prepare(sql: string): Statement;
        close(): void;
    }

    interface Statement {
        bind(params?: Record<string, unknown> | unknown[]): boolean;
        step(): boolean;
        get(params?: Record<string, unknown> | unknown[]): unknown[];
        free(): boolean;
    }

    interface QueryExecResult {
        columns: string[];
        values: unknown[][];
    }

    interface InitSqlJsOptions {
        locateFile?: (file: string) => string;
    }

    export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>;
    export { Database, Statement, QueryExecResult, SqlJsStatic, InitSqlJsOptions };
}
