import * as vscode from 'vscode';

const LANGUAGES = ['byml', 'bgyml', 'msbt'] as const;

interface TextMateRule {
    scope?: string | string[];
    settings: { foreground?: string };
}

export interface TotkColorSettings {
    tag: string;
    string: string;
    number: string;
    boolean: string;
    punctuation: string;
    msbtCommand: string;
    comment: string;
}

const DEFAULT_COLORS: TotkColorSettings = {
    tag: '#9CDCFE',
    string: '#CE9178',
    number: '#B5CEA8',
    boolean: '#569CD6',
    punctuation: '#D4D4D4',
    msbtCommand: '#C586C0',
    comment: '#6A9955',
};

export function getColorSettings(): TotkColorSettings {
    const config = vscode.workspace.getConfiguration('totk-editor');
    return {
        tag: config.get('colors.tag', DEFAULT_COLORS.tag),
        string: config.get('colors.string', DEFAULT_COLORS.string),
        number: config.get('colors.number', DEFAULT_COLORS.number),
        boolean: config.get('colors.boolean', DEFAULT_COLORS.boolean),
        punctuation: config.get('colors.punctuation', DEFAULT_COLORS.punctuation),
        msbtCommand: config.get('colors.msbtCommand', DEFAULT_COLORS.msbtCommand),
        comment: config.get('colors.comment', DEFAULT_COLORS.comment),
    };
}

export function buildTextMateRules(colors: TotkColorSettings): TextMateRule[] {
    return [
        {
            scope: ['entity.name.tag.byml', 'source.byml entity.name.tag'],
            settings: { foreground: colors.tag },
        },
        {
            scope: [
                'string.unquoted.byml',
                'string.quoted.double.byml',
                'source.byml string.unquoted',
                'source.byml string.quoted.double',
            ],
            settings: { foreground: colors.string },
        },
        {
            scope: ['constant.numeric.byml', 'source.byml constant.numeric'],
            settings: { foreground: colors.number },
        },
        {
            scope: [
                'constant.language.boolean.byml',
                'constant.language.null.byml',
            ],
            settings: { foreground: colors.boolean },
        },
        {
            scope: [
                'punctuation.definition.list.begin.byml',
                'punctuation.separator.key-value.byml',
            ],
            settings: { foreground: colors.punctuation },
        },
        {
            scope: ['constant.other.tag.byml'],
            settings: { foreground: colors.msbtCommand },
        },
        {
            scope: ['comment.line.number-sign.byml'],
            settings: { foreground: colors.comment },
        },
    ];
}

async function updateLanguageColors(
    languageId: string,
    rules: TextMateRule[] | undefined,
): Promise<void> {
    const section = vscode.workspace.getConfiguration(`[${languageId}]`);
    await section.update(
        'editor.tokenColorCustomizations',
        rules ? { textMateRules: rules } : undefined,
        vscode.ConfigurationTarget.Global,
    );
}

export async function applySyntaxColors(): Promise<void> {
    const config = vscode.workspace.getConfiguration('totk-editor');
    const enabled = config.get<boolean>('colors.enabled', true);

    if (!enabled) {
        await Promise.all(LANGUAGES.map((lang) => updateLanguageColors(lang, undefined)));
        return;
    }

    const rules = buildTextMateRules(getColorSettings());
    await Promise.all(LANGUAGES.map((lang) => updateLanguageColors(lang, rules)));
}

export async function resetSyntaxColors(): Promise<void> {
    const config = vscode.workspace.getConfiguration('totk-editor');
    const keys = [
        'colors.enabled',
        'colors.tag',
        'colors.string',
        'colors.number',
        'colors.boolean',
        'colors.punctuation',
        'colors.msbtCommand',
        'colors.comment',
    ] as const;

    await Promise.all(
        keys.map((key) =>
            config.update(key, undefined, vscode.ConfigurationTarget.Global),
        ),
    );
    await applySyntaxColors();
}

export function registerSyntaxColorSync(context: vscode.ExtensionContext): void {
    void applySyntaxColors();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('totk-editor.colors')) {
                void applySyntaxColors();
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('totk-editor.resetColors', () => {
            void resetSyntaxColors();
        }),
    );
}
