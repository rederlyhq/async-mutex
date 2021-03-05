import { E_TIMEOUT } from './errors';
import MutexInterface from './MutexInterface';
import SemaphoreInterface from './SemaphoreInterface';

export function withTimeout<U = void>(mutex: MutexInterface<U>, timeout: number, timeoutError?: Error): MutexInterface<U>;
export function withTimeout<U = void>(semaphore: SemaphoreInterface<U>, timeout: number, timeoutError?: Error): SemaphoreInterface<U>;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function withTimeout<U = void>(sync: MutexInterface<U> | SemaphoreInterface<U>, timeout: number, timeoutError = E_TIMEOUT) {
    return {
        acquire: (data: U): Promise<MutexInterface.Releaser | [number, SemaphoreInterface.Releaser]> =>
            new Promise(async (resolve, reject) => {
                let isTimeout = false;

                const handle = setTimeout(() => {
                    isTimeout = true;
                    reject(timeoutError);
                }, timeout);

                try {
                    const ticket = await sync.acquire(data);

                    if (isTimeout) {
                        const release = Array.isArray(ticket) ? ticket[1] : ticket;

                        release();
                    } else {
                        clearTimeout(handle);
                        resolve(ticket);
                    }
                } catch (e) {
                    if (!isTimeout) {
                        clearTimeout(handle);

                        reject(e);
                    }
                }
            }),

        async runExclusive<T>(callback: (value?: number) => Promise<T> | T, data: U): Promise<T> {
            let release: () => void = () => undefined;

            try {
                const ticket = await this.acquire(data);

                if (Array.isArray(ticket)) {
                    release = ticket[1];

                    return await callback(ticket[0]);
                } else {
                    release = ticket;

                    return await callback();
                }
            } finally {
                release();
            }
        },

        /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
        release(): void {
            sync.release();
        },

        cancel(): void {
            return sync.cancel();
        },

        isLocked: (): boolean => sync.isLocked(),
    };
}
