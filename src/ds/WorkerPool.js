import { Worker } from "worker_threads";

export class WorkerPool {
    constructor(workerFile, poolSize, workerData) {
        this.workers = [];
        this.index = 0;

        for (let i = 0; i < poolSize; i++) {
            const worker = new Worker(workerFile, { workerData });
            worker.on('error', (err) => console.error('Worker error:', err));
            worker.on('exit', (code) => {
                if (code !== 0) console.error(`Worker exited with code ${code}`);
            });
            this.workers.push(worker);
        }
    }

    getNextWorker() {
        const worker = this.workers[this.index];
        this.index = (this.index + 1) % this.workers.length;
        return worker;
    }

    postTask(task) {
        const worker = this.getNextWorker();
        worker.postMessage(task);
    }
}