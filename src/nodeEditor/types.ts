export type NodeRoleColor =
    | 'blue'
    | 'red'
    | 'green'
    | 'brown'
    | 'purple'
    | 'gray'
    | 'notimplemented';

export type NodeEditorPin = {
    id: string;
    label: string;
    linked: boolean;
};

export type NodeEditorNode = {
    id: string;
    label: string;
    typeLabel: string;
    x: number;
    y: number;
    tags: string[];
    roleColor: NodeRoleColor | string;
    inputPins: NodeEditorPin[];
    outputPins: NodeEditorPin[];
    sections: Array<{
        title: string;
        entries: string[];
    }>;
};

export type NodeEditorEdge = {
    id: string;
    source: string;
    target: string;
    label: string;
    sourceHandle?: string;
    targetHandle?: string;
    animated?: boolean; // We'll use this to make Data flow edges animated vs Flow edges static
};

export type NodeEditorModel = {
    formatId: string;
    fileName: string;
    nodes: NodeEditorNode[];
    edges: NodeEditorEdge[];
    commands?: any[];
    blackboard?: any;
    rawNodes?: any[]; // Keep a reference to raw nodes for the inspector
};
export type AdapterParseResult = {
    model: NodeEditorModel;
    originalText: string;
};

export interface NodeFormatAdapter {
    readonly id: string;
    supports(filePath: string): boolean;
    parse(filePath: string, rawText: string): AdapterParseResult;
}