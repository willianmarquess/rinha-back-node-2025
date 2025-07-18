import { fetchWithTimeout } from "./utils/fetchWithTimeout.js";

const HEALTH_CHECK_TIMEOUT = 15_000;
const HEALTH_CHECK_INTERVAL = 5_050;

export class HealthCheckMonitor {
    #config;
    #redisCacheProvider;
    #paymentProcessorChooser;

    constructor({ config, redisCacheProvider, paymentProcessorChooser }) {
        this.#config = config;
        this.#redisCacheProvider = redisCacheProvider;
        this.#paymentProcessorChooser = paymentProcessorChooser;
    }

    async init() {
        await this.#execute();

        setInterval(async () => {
            await this.#execute();
        }, HEALTH_CHECK_INTERVAL);
    }

    async #execute() {
        const defaultHealthCheckResult = await this.#checkHealth(this.#config.DEFAULT.health_check_url);
        await this.#redisCacheProvider.set('healthcheck-default', JSON.stringify({
            failing: defaultHealthCheckResult.failing,
            minResponseTime: defaultHealthCheckResult.minResponseTime
        }));

        const fallbackHealthCheckResult = await this.#checkHealth(this.#config.FALLBACK.health_check_url);
        await this.#redisCacheProvider.set('healthcheck-fallback', JSON.stringify({
            failing: fallbackHealthCheckResult.failing,
            minResponseTime: fallbackHealthCheckResult.minResponseTime
        }));

        await this.#paymentProcessorChooser.execute(defaultHealthCheckResult, fallbackHealthCheckResult);
    }

    async #checkHealth(url) {
        const { data } = await fetchWithTimeout(url, HEALTH_CHECK_TIMEOUT);

        if (!data) {
            return {
                failing: true,
                minResponseTime: 0,
            }
        }

        return {
            failing: data.failing,
            minResponseTime: data.minResponseTime,
        }
    }
}