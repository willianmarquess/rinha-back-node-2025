import Fastify from 'fastify';
import RedisProvider from './redis/RedisProvider.js';
import path from 'path';
import { HealthCheckMonitor } from './HealthCheckMonitor.js';
import { PaymentProcessorChooser } from './PaymentProcessorChooser.js';
import { Worker } from 'worker_threads';
import { PaymentSummarizer } from './PaymentSummarizer.js';

const REDIS_HOST = process.env.REDIS_HOST;
const DEFAULT_URL = process.env.PAYMENT_PROCESSOR_URL_DEFAULT || 'http://localhost:8001';
const FALLBACK_URL = process.env.PAYMENT_PROCESSOR_URL_FALLBACK || 'http://localhost:8002';
const HEALTH_CHECK_ENABLED = process.env.HEALTH_CHECK_ENABLED;
const redisCacheProvider = new RedisProvider({ host: REDIS_HOST, port: 6379 });

await redisCacheProvider.init();

const PAYMENT_PROCESSORS_CONFIG = {
    DEFAULT: {
        maxAttemp: 3,
        payment_url: `${DEFAULT_URL}/payments/`,
        health_check_url: `${DEFAULT_URL}/payments/service-health`,
    },
    FALLBACK: {
        payment_url: `${FALLBACK_URL}/payments/`,
        health_check_url: `${FALLBACK_URL}/payments/service-health`,
        maxAttemp: 3,
    }
};

if (HEALTH_CHECK_ENABLED) {
    const paymentProcessorChooser = new PaymentProcessorChooser({
        redisCacheProvider
    })
    const healthCheckMonitor = new HealthCheckMonitor({
        config: PAYMENT_PROCESSORS_CONFIG,
        redisCacheProvider,
        paymentProcessorChooser
    })

    await healthCheckMonitor.init();
}

const worker = new Worker(path.resolve('./src/worker.js'), {
    workerData: {
        processorConfig: PAYMENT_PROCESSORS_CONFIG,
        redisConfig: { host: REDIS_HOST, port: 6379 },
    }
});

const paymentSummarizer = new PaymentSummarizer({
    redisCacheProvider
});

const app = Fastify({
    logger: false,
});

app.post('/payments', {
    schema: {
        body: {
            type: 'object',
            required: ['correlationId', 'amount'],
            properties: {
                correlationId: { type: 'string', minLength: 36, maxLength: 36 },
                amount: { type: 'number' }
            }
        }
    },
    async handler(req, res) {
        const { correlationId, amount } = req.body;
        worker.postMessage({ correlationId, amount, requestedAt: new Date().toISOString() });
        res.status(202).send();
        
    }
});

app.get('/payments-summary', {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                from: { type: 'string', format: 'date-time' },
                to: { type: 'string', format: 'date-time' },
            },
        },
    },
    async handler(req, res) {
        let { from, to } = req.query;

        if (!from) {
            from = new Date().toISOString();
        }

        if (!to) {
            to = new Date().toISOString();
        }

        const fromTimestamp = new Date(from).getTime();
        const toTimestamp = new Date(to).getTime();

        if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
            return res.status(400).send({ error: 'Invalid datetime format' });
        }

        const result = await paymentSummarizer.execute(fromTimestamp, toTimestamp);

        res.status(200).send(result);
    }
})

app.get('/healthcheck', (_req, res) => {
    res.send('OK');
});

app.post('/purge-payments', async (_req, res) => {
    await redisCacheProvider.flush();
    res.send('OK');
});

app.setErrorHandler((error, _req, res) => {
    if (error.code === 'FST_ERR_VALIDATION') {
        return res.status(400).send({ message: error.message });
    }
    return res.status(500);
});

app.listen({ port: 3333, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`App rodando 🔥`);
});