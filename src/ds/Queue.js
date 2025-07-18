import { EventEmitter } from 'node:events';

export default class Queue {
    maxSize;
    items;
    frontPos;
    rearPos;
    length;

    emitter;

    constructor(size = Number.MAX_SAFE_INTEGER) {
        this.maxSize = size;
        this.items = {};
        this.frontPos = 0;
        this.rearPos = -1;
        this.length = 0;
        this.emitter = new EventEmitter();
    }

    dequeue() {
        if (this.isEmpty()) return;
        const dequeued = this.front();
        delete this.items[(this.frontPos %= this.maxSize)];
        this.frontPos++;
        this.length--;
        return dequeued;
    }

    *dequeueIterator() {
        while (!this.isEmpty()) {
            yield this.dequeue();
        }
    }

    enqueue(item) {
        if (this.isFull()) {
            console.log(`Queue is full!!!`);
            return;
        }
        this.rearPos++;
        this.length++;
        this.items[(this.rearPos %= this.maxSize)] = item;
        this.emitter.emit('enqueue');
    }

    isFull() {
        return this.length >= this.maxSize;
    }

    isEmpty() {
        return this.length < 1;
    }

    rear() {
        return this.items[this.rearPos];
    }

    front() {
        if (this.isEmpty()) return;
        return this.items[this.frontPos % this.maxSize];
    }

    size() {
        return this.length;
    }

    [Symbol.asyncIterator]() {
        return {
            next: () =>
                new Promise((resolve) => {
                    const val = this.dequeue();
                    if (val !== undefined) return resolve({ value: val, done: false });
                    this.emitter.once('enqueue', () =>
                        resolve({ value: this.dequeue(), done: false })
                    );
                }),
        };
    }
}