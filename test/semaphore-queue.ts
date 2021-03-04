import Semaphore, { QueueEntry, QueueLike } from '../src/Semaphore';
import TinyQueue from "tinyqueue";
import { semaphoreSuite } from './semaphore';
import { mutexSuite } from './mutex';
import Mutex from '../src/Mutex';

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
}

suite('Semaphore with Priority Queue', () => {
    const priorityQueue = new HeapHelper<QueueEntry>();
    semaphoreSuite((maxConcurrency: number, err?: Error) => new Semaphore(maxConcurrency, err, priorityQueue));

    // TODO: These tests validate the expected behavior of TinyQueue + Semaphore.
});


suite('Mutex with Priority Queue', () => {
    const priorityQueue = new HeapHelper<QueueEntry>();
    mutexSuite((err?: Error) => new Mutex(err, priorityQueue));

    // TODO: These tests validate the expected behavior of TinyQueue + Mutex.
});

