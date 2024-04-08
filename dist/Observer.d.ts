import type React from 'react';
export declare class Reaction {
    static readonly empty: Reaction;
    readonly uid: string;
    renderCycle: number;
    readonly listener: () => void;
    constructor(listener: () => void);
    private _isDisposed;
    get isDisposed(): boolean;
    dispose(): void;
    run(): void;
}
export declare class ReactionSet {
    private reactions;
    private readonly hash;
    get size(): number;
    add(r: Reaction): void;
    clear(): void;
    remove(predicate: (r: Reaction) => boolean): void;
    forEach(callbackFn: (r: Reaction) => void): void;
}
export declare class ObservableGlobalState {
    static renderCycle: number;
    static reaction: Reaction;
    static testMode: boolean;
    static debug: boolean;
}
export declare enum ReactionRunnerStatus {
    IDLE = "IDLE",
    PENDING = "PENDING",
    RUNNING = "LOADING"
}
export declare class Observable {
    readonly reactions: ReactionSet;
    readonly className: string;
    constructor(className?: string);
    addReaction(reaction: Reaction): void;
    subscribe(callback: () => void): () => void;
    private _isMutated;
    get isMutated(): boolean;
    private _isDisposed;
    get isDisposed(): boolean;
    mutated(): void;
    ready(): void;
    dispose(): void;
}
export declare function observe<T extends Observable | undefined>(observable: T): T;
export declare function observer<T>(component: (props: T) => React.JSX.Element): ((props: T) => React.JSX.Element);
