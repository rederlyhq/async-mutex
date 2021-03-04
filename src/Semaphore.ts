import { E_CANCELED } from './errors';
import SemaphoreInterface from './SemaphoreInterface';

export interface QueueEntry<T = void> {
    resolve: (ticket: [number, SemaphoreInterface.Releaser]) => void;
    reject: (err: Error) => void;
    data: T;
}

export interface QueueLike<T> {
    push: (...items: T[]) => number;
    shift: () => T | undefined;
    forEach: (callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: unknown) => void;
    length: number;
}

export type QueueLikeSemaphore = QueueLike<QueueEntry>;
export type QueueLikeArray = QueueEntry[];

class Semaphore<U = void> implements SemaphoreInterface<U> {
    constructor(private _maxConcurrency: number, private _cancelError: Error = E_CANCELED, private _queue: QueueLike<QueueEntry<U>> = <QueueEntry<U>[]>[]) {
        if (_maxConcurrency <= 0) {
            throw new Error('semaphore must be initialized to a positive value');
        }

        this._value = _maxConcurrency;
    }

    acquire(data: U): Promise<[number, SemaphoreInterface.Releaser]> {
        const locked = this.isLocked();
        const ticketPromise = new Promise<[number, SemaphoreInterface.Releaser]>((resolve, reject) =>
            this._queue.push({ resolve, reject, data })
        );

        if (!locked) this._dispatch();

        return ticketPromise;
    }

    async runExclusive<T>(callback: SemaphoreInterface.Worker<T>, data: U): Promise<T> {
        const [value, release] = await this.acquire(data);

        try {
            return await callback(value);
        } finally {
            release();
        }
    }

    isLocked(): boolean {
        return this._value <= 0;
    }

    /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
    release(): void {
        if (this._maxConcurrency > 1) {
            throw new Error(
                'this method is unavailable on semaphores with concurrency > 1; use the scoped release returned by acquire instead'
            );
        }

        if (this._currentReleaser) {
            const releaser = this._currentReleaser;
            this._currentReleaser = undefined;

            releaser();
        }
    }

    cancel(): void {
        this._queue.forEach((ticket) => ticket.reject(this._cancelError));
        this._queue.length = 0;
    }

    private _dispatch(): void {
        const nextTicket = this._queue.shift();

        if (!nextTicket) return;

        let released = false;
        this._currentReleaser = () => {
            if (released) return;

            released = true;
            this._value++;

            this._dispatch();
        };

        nextTicket.resolve([this._value--, this._currentReleaser]);
    }

    private _currentReleaser: SemaphoreInterface.Releaser | undefined;
    private _value: number;
}

export default Semaphore;
