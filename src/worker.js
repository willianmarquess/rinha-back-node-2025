import { parentPort, workerData } from 'worker_threads';
import RedisProvider from './redis/RedisProvider.js';
import Queue from "./ds/Queue.js";
import { PaymentSender } from './PaymentSender.js';

const { processorConfig, redisConfig } = workerData;

const redisCacheProvider = new RedisProvider(redisConfig);
await redisCacheProvider.init();

const queue = new Queue(10_000);

const paymentSender = new PaymentSender({
    redisCacheProvider,
    config: processorConfig,
    queue
});

parentPort.on('message', async (payment) => {
    queue.enqueue(payment);
});

const executions = [];

for await (const payment of queue) {
    executions.push(paymentSender.execute(payment));
    const shouldFlush = executions.length >= 20;

    if (shouldFlush) {
        await Promise.all(executions);
        executions.length = 0;
    }
}