import Semaphore, { QueueEntry, QueueLike } from '../src/Semaphore';
import TinyQueue from "tinyqueue";
import { semaphoreSuite } from './semaphore';
import { mutexSuite } from './mutex';
import Mutex from '../src/Mutex';
import assert from 'assert';
import { InstalledClock, install } from '@sinonjs/fake-timers';
import SemaphoreInterface from '../src/SemaphoreInterface';

export default class HeapHelper<T> implements QueueLike<T> {
    constructor(private _queue: TinyQueue<T> = new TinyQueue()) {
    }

    pop = (): T | undefined => this._queue.pop();

    push = (...items: T[]): number => {
        for (const item of items) {
            this._queue.push(item);
        }
        return items.length;
    }

    shift = this.pop;

    unshift = this.push;

    get length(): number {
        return this._queue.length;
    }

    set length(n: number) {
        this._queue.length = n;
        this._queue.data.length = n;
    }

    forEach = (callbackfn: (value: T, index: number, array: T[]) => void): void => {
        this._queue.data.forEach((value, index, array) => {
            callbackfn(value, index, array);
        });
    }

    toString = (): string => JSON.stringify(this._queue.data);
}

suite('Semaphore with Priority Queue', () => {
    const priorityQueue = new HeapHelper<QueueEntry>();
    semaphoreSuite((maxConcurrency: number, err?: Error) => new Semaphore(maxConcurrency, err, priorityQueue));

    // These tests validate the expected behavior of TinyQueue + Semaphore.
    suite('TinyQueue Implementation Tests', () => {
        let semaphore: SemaphoreInterface<number>;
        let clock: InstalledClock;
        const maxPriorityQueue = new TinyQueue<QueueEntry<number>>([], (a, b) => b.data - a.data);
        const heap = new HeapHelper<QueueEntry<number>>(maxPriorityQueue);

        setup(() => {
            clock = install();
            semaphore = new Semaphore(2, undefined, heap);
        });

        teardown(() => clock.uninstall());

        test('Semaphore releases higher priority tasks first', async () => {

            const [, release1] = await semaphore.acquire(0);
            const [,] = await semaphore.acquire(2);
            let prio5Finished = false;
            let prio1Finished = false;
            let prio10Finished = false;

            (async () => {
                await semaphore.acquire(5);
                prio5Finished = true;
            })();

            (async () => {
                await semaphore.acquire(1);
                prio1Finished = true;
            })();

            (async () => {
                await semaphore.acquire(10);
                prio10Finished = true;
            })();

            release1();
            await clock.tickAsync(1);

            assert(prio5Finished === false, 'Priority 5 finished before Priority 10 AND Priority 1.');
            assert(prio1Finished === false, 'Priority 1 finished before Priority 10.');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio10Finished === true, 'Priority 10 was not completed after semaphore was released.');
        });
    })
});

suite('Mutex with Priority Queue', () => {
    const priorityQueue = new HeapHelper<QueueEntry>();
    mutexSuite((err?: Error) => new Mutex(err, priorityQueue));

    // TODO: These tests validate the expected behavior of TinyQueue + Mutex.
});

suite('withTimeout with Priority Queue', () => {
    // const priorityQueue = new HeapHelper<QueueEntry>();

    // TODO: These tests validate the expected behavior of TinyQueue + withTimeout.
});

