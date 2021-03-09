import Semaphore, { QueueEntry, QueueLike } from '../src/Semaphore';
import TinyQueue from "tinyqueue";
import { semaphoreSuite } from './semaphore';
import { mutexSuite } from './mutex';
import Mutex from '../src/Mutex';
import assert from 'assert';
import { InstalledClock, install } from '@sinonjs/fake-timers';
import SemaphoreInterface from '../src/SemaphoreInterface';

export default class HeapHelper<T> implements QueueLike<T> {
    constructor(private _queue: TinyQueue<T>, private _comparator: (a: T, b: T) => number) {
        this._queue = new TinyQueue(_queue.data ?? [], _comparator);
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

    heapify = (): void => {
        this._queue = new TinyQueue(this._queue.data, this._comparator);
    }
}

suite('Semaphore with Priority Queue', () => {
    const priorityQueue = new HeapHelper<QueueEntry>(new TinyQueue(), () => 1);
    semaphoreSuite((maxConcurrency: number, err?: Error) => new Semaphore(maxConcurrency, err, priorityQueue));

    // These tests validate the expected behavior of TinyQueue + Semaphore.
    suite('TinyQueue Implementation Tests', () => {
        let semaphore: SemaphoreInterface<number>;
        let clock: InstalledClock;
        const maxPriorityQueue = new TinyQueue<QueueEntry<number>>([], (a, b) => b.data - a.data);
        const heap = new HeapHelper<QueueEntry<number>>(maxPriorityQueue, (a, b) => b.data - a.data);

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

            let prio5release = () => console.error('Release function not initialized');
            let prio1release = () => console.error('Release function not initialized');
            let prio10release = () => console.error('Release function not initialized');

            (async () => {
                prio5release = (await semaphore.acquire(5))[1];
                prio5Finished = true;
            })();

            (async () => {
                prio1release = (await semaphore.acquire(1))[1];
                prio1Finished = true;
            })();

            (async () => {
                prio10release = (await semaphore.acquire(10))[1];
                prio10Finished = true;
            })();

            release1();
            await clock.tickAsync(1);

            assert(prio5Finished === false, 'Priority 5 finished before Priority 10 AND Priority 1.');
            assert(prio1Finished === false, 'Priority 1 finished before Priority 10.');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio10Finished === true, 'Priority 10 was not completed after semaphore was released.');
            prio10release();

            await clock.tickAsync(1);
            assert(prio1Finished === false, 'Priority 1 finished before Priority 5.');
            assert(prio10Finished === true, 'Priority 10\'s state changed, is the test broken?');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio5Finished === true, 'Priority 5 did not finished after Priority 10 and before Priority 1.');
            prio5release();

            await clock.tickAsync(1);
            assert(prio5Finished === true, 'Priority 5\'s state changed, is the test broken?');
            assert(prio10Finished === true, 'Priority 10\'s state changed, is the test broken?');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio1Finished === true, 'Priority 1 did not finish after Priority 5 and Priority 10 finished.');
            prio1release();
        });

        test('Semaphore works for objects with custom comparator', async () => {
            const maxPriorityQueue = new TinyQueue<QueueEntry<{ desc: string, val: number }>>([], (a, b) => b.data.val - a.data.val);
            const heap2 = new HeapHelper<QueueEntry<{ desc: string, val: number }>>(maxPriorityQueue, (a, b) => b.data.val - a.data.val);
            const semaphore2 = new Semaphore<{ desc: string, val: number }>(2, undefined, heap2);
            const [, release1] = await semaphore2.acquire({ desc: 'default 10', val: 10 });
            const [, release2] = await semaphore2.acquire({ desc: 'default 12', val: 12 });

            const priorities = [{ desc: '1', val: 1 }, { desc: '2', val: 2 }, { desc: '3', val: 3 }, { desc: '4', val: 4 },];

            let prio1Finished = false;
            let prio2Finished = false;
            let prio3Finished = false;

            let prio1release = () => console.error('Release function not initialized');
            let prio2release = () => console.error('Release function not initialized');
            let prio3release = () => console.error('Release function not initialized');

            (async () => {
                prio1release = (await semaphore2.acquire(priorities[0]))[1];
                prio1Finished = true;
            })();

            (async () => {
                prio2release = (await semaphore2.acquire(priorities[1]))[1];
                prio2Finished = true;
            })();

            (async () => {
                prio3release = (await semaphore2.acquire(priorities[2]))[1];
                prio3Finished = true;
            })();
            release1();

            await clock.tickAsync(1);
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio3Finished === true, 'Priority 3 did not finish before Priorities 1 and 2.');
            assert(prio2Finished === false, 'Priority 2 finished before Priority 3 was released.');
            assert(prio1Finished === false, 'Priority 1 finished before Priority 3 was released.');
            prio3release();

            await clock.tickAsync(1);
            assert(prio3Finished === true, 'Priority 3\'s status reverted. Is this test broken?');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio2Finished === true, 'Priority 2 did not finish before Priority 1.');
            assert(prio1Finished === false, 'Priority 1 finished before Priority 2 was released.');
            prio2release();

            await clock.tickAsync(1);
            assert(prio3Finished === true, 'Priority 3\'s status reverted. Is this test broken?');
            assert(prio2Finished === true, 'Priority 2\'s status reverted. Is this test broken?');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio1Finished === true, 'Priority 1 finished before Priority 2 was released.');
            prio1release();

            release2();
        });

        test('Semaphore respects heapifying the priority queue', async () => {
            const maxPriorityQueue = new TinyQueue<QueueEntry<{ desc: string, val: number }>>([], (a, b) => b.data.val - a.data.val);
            const heap = new HeapHelper<QueueEntry<{ desc: string, val: number }>>(maxPriorityQueue, (a, b) => b.data.val - a.data.val);
            const semaphore = new Semaphore<{ desc: string, val: number }>(2, undefined, heap);
            const [, release1] = await semaphore.acquire({ desc: 'default 10', val: 10 });
            const [, release2] = await semaphore.acquire({ desc: 'default 12', val: 12 });

            const priorities = [{ desc: '1', val: 1 }, { desc: '2', val: 2 }, { desc: '3', val: 3 }, { desc: '4', val: 4 },];

            let prio1Finished = false;
            let prio2Finished = false;
            let prio3Finished = false;

            let prio1release: SemaphoreInterface.Releaser = () => { throw new Error('Release function not initialized') };
            let prio2release: SemaphoreInterface.Releaser = () => { throw new Error('Release function not initialized') };
            let prio3release: SemaphoreInterface.Releaser = () => { throw new Error('Release function not initialized') };

            (async () => {
                prio1release = (await semaphore.acquire(priorities[0]))[1];
                prio1Finished = true;
            })();

            (async () => {
                prio2release = (await semaphore.acquire(priorities[1]))[1];
                prio2Finished = true;
            })();

            (async () => {
                prio3release = (await semaphore.acquire(priorities[2]))[1];
                prio3Finished = true;
            })();

            console.log(heap.toString());
            release1();

            await clock.tickAsync(1);
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio3Finished === true, 'Priority 3 did not finish before Priorities 1 and 2.');
            assert(prio2Finished === false, 'Priority 2 finished before Priority 3 was released.');
            assert(prio1Finished === false, 'Priority 1 finished before Priority 3 was released.');

            // Raise the priority of Priority 1 before releasing.
            console.log(heap.toString());
            priorities[0].val = 14;
            heap.heapify();

            prio3release();

            await clock.tickAsync(1);
            assert(prio3Finished === true, 'Priority 3\'s status reverted. Is this test broken?');
            assert(prio2Finished === false, 'Priority 2 finished before Priority 1 (now 14).');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio1Finished === true, 'Priority 1 (now 14) did not finish before Priority 2 was released.');
            prio1release();

            await clock.tickAsync(1);
            assert(prio3Finished === true, 'Priority 3\'s status reverted. Is this test broken?');
            assert(prio1Finished === true, 'Priority 1\'s status reverted. Is this test broken?');
            //@ts-expect-error Typescript doesn't know if a promise will run before this.
            assert(prio2Finished === true, 'Priority 2 finished before Priority 2 was released.');
            prio2release();

            release2();
        });
    })
});

suite('Mutex with Priority Queue', () => {
    const priorityQueue = new HeapHelper<QueueEntry>(new TinyQueue(), () => 1);
    mutexSuite((err?: Error) => new Mutex(err, priorityQueue));

    // TODO: These tests validate the expected behavior of TinyQueue + Mutex.
});

suite('withTimeout with Priority Queue', () => {
    // const priorityQueue = new HeapHelper<QueueEntry>();

    // TODO: These tests validate the expected behavior of TinyQueue + withTimeout.
});

