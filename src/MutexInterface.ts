interface MutexInterface<U = void> {
    acquire(data: U): Promise<MutexInterface.Releaser>;

    runExclusive<T>(callback: MutexInterface.Worker<T>, data: U): Promise<T>;

    isLocked(): boolean;

    /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
    release(): void;

    cancel(): void;
}

namespace MutexInterface {
    export interface Releaser {
        (): void;
    }

    export interface Worker<T> {
        (): Promise<T> | T;
    }
}

export default MutexInterface;
