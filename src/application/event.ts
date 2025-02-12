export type EventMap<T extends Record<keyof T, any[]>> = Record<keyof T, any[]>;

export type EventListener<A extends any[]> = (...args: A) => void|Promise<void>;

export interface EventObserver<T extends EventMap<T>> {
    on<E extends keyof T>(event: E, listener: EventListener<T[E]>): void;
    off<E extends keyof T>(event: E, listener: EventListener<T[E]>): void;
}

export class EventDispatcher<T extends EventMap<T>> implements EventObserver<T> {
    private listeners: Partial<Record<keyof T, Set<EventListener<any[]>>>> = {};

    public on<E extends keyof T>(event: E, listener: (...args: T[E]) => void|Promise<void>): void {
        if (this.listeners[event] === undefined) {
            this.listeners[event] = new Set();
        }

        this.listeners[event].add(listener);
    }

    public off<E extends keyof T>(event: E, listener: (...args: T[E]) => void|Promise<void>): void {
        if (this.listeners[event] === undefined) {
            return;
        }

        this.listeners[event].delete(listener);
    }

    public async emit<E extends keyof T>(event: E, ...args: T[E]): Promise<void> {
        if (this.listeners[event] === undefined) {
            return;
        }

        await Promise.all(Array.from(this.listeners[event]).map(listener => listener(...args)));
    }
}
