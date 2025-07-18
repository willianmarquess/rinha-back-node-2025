import { Agent, request, setGlobalDispatcher, Pool } from 'undici';

const agent = new Agent({
    keepAliveTimeout: 10_000,
    connect: {
        keepAlive: true,
    } 
})

setGlobalDispatcher(agent);

export const fetchWithTimeout = async (url, timeout, method, body) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);

    try {
        const res = await request(url, {
            body: JSON.stringify(body),
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            signal: ctrl.signal,
        })

        if (res.statusCode !== 200) {
            return {
                data: undefined,
                status: res.statusCode,
            };
        }

        const jsonResponse = await res.body.json();
        return {
            data: jsonResponse,
            status: res.statusCode,
        };
    } catch (err) {
        console.log('fetchWithTimeout', err);
        return {};
    } finally {
        clearTimeout(t);
    }
};
