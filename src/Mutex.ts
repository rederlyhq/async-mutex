import MutexInterface from './MutexInterface';
import Semaphore, { QueueEntry, QueueLike } from './Semaphore';

class Mutex<U = void> implements MutexInterface<U> {
    constructor(cancelError?: Error, queue?: QueueLike<QueueEntry<U>>) {
        this._semaphore = new Semaphore<U>(1, cancelError, queue);
    }

    async acquire(data: U): Promise<MutexInterface.Releaser> {
        const [, releaser] = await this._semaphore.acquire(data);

        return releaser;
    }

    runExclusive<T>(callback: MutexInterface.Worker<T>, data: U): Promise<T> {
        return this._semaphore.runExclusive(() => callback(), data);
    }

    isLocked(): boolean {
        return this._semaphore.isLocked();
    }

    /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
    release(): void {
        this._semaphore.release();
    }

    cancel(): void {
        return this._semaphore.cancel();
    }

    private _semaphore: Semaphore<U>;
}

export default Mutex;
