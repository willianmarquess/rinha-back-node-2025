import { PaymentProcessor } from "./enums/PaymentProcessor.js";

export class PaymentProcessorChooser {
    #redisCacheProvider;

    constructor({ redisCacheProvider }) {
        this.#redisCacheProvider = redisCacheProvider;
    }

    #choose(defaultHealthCheckResult, fallbackHealthCheckResult) {
        if (defaultHealthCheckResult?.failing) return PaymentProcessor.DEFAULT;
        if (fallbackHealthCheckResult?.failing) return PaymentProcessor.FALLBACK;

        return defaultHealthCheckResult?.minResponseTime <= fallbackHealthCheckResult?.minResponseTime ? PaymentProcessor.DEFAULT : PaymentProcessor.FALLBACK;
    }

    async execute(defaultHealthCheckResult, fallbackHealthCheckResult) {
        const paymentProcessor = this.#choose(defaultHealthCheckResult, fallbackHealthCheckResult);
        await this.#redisCacheProvider.set('payment-processor', paymentProcessor);
    }
}