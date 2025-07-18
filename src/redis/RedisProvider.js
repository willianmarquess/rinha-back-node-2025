import * as redis from 'redis';

export default class RedisProvider {
    client;

    constructor({ host, port }) {
        this.client = redis.createClient({
            socket: {
                host,
                port,
            },
            pingInterval: 5_000,
        });
    }

    async init() {
        await this.client.connect();
        this.client.on('error', this.onError.bind(this));
        console.log('[CACHE] Connected with success.');
    }

    onError(error) {
        console.log('[CACHE] Connection error: ', error);
    }

    async set(key, value, expirationInSec) {
        await this.client.set(key, value);
        if (expirationInSec) {
            await this.client.expire(key, expirationInSec);
        }
    }

    async get(key) {
        return this.client.get(key);
    }

    async delete(key) {
        await this.client.del(key);
    }

    async close() {
        console.log('[CACHE] Closing connection');
        await this.client.quit();
        console.log('[CACHE] Connection closed');
    }

    async exists(key) {
        const exists = await this.client.exists(key);
        return !!exists;
    }

    async keys(pattern) {
        return this.client.keys(pattern);
    }

    async publish(channel, body) {
        return this.client.publish(channel, JSON.stringify(body));
    }

    async subscribe(channel, callback) {
        return this.client.subscribe(channel, (msg) => callback(JSON.parse(msg)));
    }

    async zAdd(key, score, value) {
        return this.client.zAdd(key, {
            score,
            value: JSON.stringify(value)
        })
    }

    async zRangeByScore(key, from, to) {
        return this.client.zRangeByScore(key, from, to);
    }

    async flush() {
        return this.client.flushAll();
    }
}