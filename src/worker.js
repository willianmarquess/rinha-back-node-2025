import { parentPort, workerData } from 'worker_threads';
import RedisProvider from './redis/RedisProvider.js';
import Queue from "./ds/Queue.js";
import { fetchWithTimeout } from './utils/fetchWithTimeout.js';
import { PaymentProcessor } from './enums/PaymentProcessor.js';

const { processorConfig, redisConfig } = workerData;

const redisProvider = new RedisProvider(redisConfig);
await redisProvider.init();

const queue = new Queue(10_000);

const save = async (paymentProcessorName, payment, timestamp) => {
    await redisProvider.zAdd(`transactions:log:${paymentProcessorName}`, timestamp, payment);
}

const choosePaymentProcessor = async () => {
    const paymentProcessorName = await redisProvider.get('payment-processor');
    return paymentProcessorName || PaymentProcessor.DEFAULT;
}

const setPaymentProcessor = async (paymentProcessorName) => {
    return redisProvider.set('payment-processor', paymentProcessorName);
}

const execute = async (payment, retry = 0) => {
    if (retry >= 10) {
        console.log(`Discart payment: `, payment);
        return;
    }

    const paymentProcessorName = await choosePaymentProcessor();

    switch (paymentProcessorName) {
        case PaymentProcessor.DEFAULT: {
            console.log('sending to: ', paymentProcessorName);
            const paymentProcessorConfig = processorConfig[paymentProcessorName];
            const timestamp = new Date(payment.requestedAt).getTime();

            const { data, status } = await fetchWithTimeout(paymentProcessorConfig.payment_url, 10_000, 'POST', payment);

            if (data) {
                await save(paymentProcessorName, payment, timestamp);
                return;
            }

            if (status >= 400 && status <= 499) return;

            return execute(payment, retry + 1);
        }

        case PaymentProcessor.FALLBACK: {
            console.log('sending to: ', paymentProcessorName);
            const paymentProcessorConfig = processorConfig[paymentProcessorName];
            const timestamp = new Date(payment.requestedAt).getTime();

            const { data, status } = await fetchWithTimeout(paymentProcessorConfig.payment_url, 10_000, 'POST', payment);

            if (data) {
                await save(paymentProcessorName, payment, timestamp);
                return;
            }

            if (status >= 400 && status <= 499) return;

            await setPaymentProcessor(PaymentProcessor.DEFAULT);
            return execute(payment, retry + 1);
        }
    }

}

parentPort.on('message', async (payment) => {
    queue.enqueue(payment);
});

const executions = [];
let lastFlush = performance.now();
const FLUSH_INTERVAL_MS = 100;

for await (const payment of queue) {
    executions.push(execute(payment, queue));
    const now = performance.now();
    const shouldFlush = executions.length >= 20 || now - lastFlush > FLUSH_INTERVAL_MS;

    if (shouldFlush) {
        await Promise.all(executions);
        executions.length = 0;
        lastFlush = now;
    }
}