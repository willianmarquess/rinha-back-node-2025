import { PaymentProcessor } from "./enums/PaymentProcessor.js";
import { fetchWithTimeout } from "./utils/fetchWithTimeout.js";

const PAYMENT_PROCESSOR_TIMEOUT = 10_000;

export class PaymentSender {
    #redisCacheProvider;
    #config;
    #queue;

    constructor({ redisCacheProvider, config, queue }) {
        this.#redisCacheProvider = redisCacheProvider;
        this.#config = config;
        this.#queue = queue;
    }

    async #save(paymentProcessorName, payment, timestamp) {
        await this.#redisCacheProvider.zAdd(`transactions:log:${paymentProcessorName}`, timestamp, payment);
    }

    async #getPaymentProcessor() {
        const paymentProcessorName = await this.#redisCacheProvider.get('payment-processor');
        return paymentProcessorName || PaymentProcessor.DEFAULT;
    }

    async #setPaymentProcessor(paymentProcessorName) {
        return this.#redisCacheProvider.set('payment-processor', paymentProcessorName);
    }

    async #sendPayment(paymentProcessorName, payment) {
        const paymentProcessorConfig = this.#config[paymentProcessorName];
        const timestamp = new Date(payment.requestedAt).getTime();

        const { data, status } = await fetchWithTimeout(paymentProcessorConfig.payment_url, PAYMENT_PROCESSOR_TIMEOUT, 'POST', payment);

        if (data) {
            await this.#save(paymentProcessorName, payment, timestamp);
            return true;
        }

        if (status >= 400 && status <= 499) return true; //just to ignore

        return false;
    }

    async execute(payment) {
        const paymentProcessorName = await this.#getPaymentProcessor();

        switch (paymentProcessorName) {
            case PaymentProcessor.DEFAULT: {
                if (!(await this.#sendPayment(paymentProcessorName, payment))) {
                    //this could cause infinity loop, but for this tests it should never happen
                    //do not do this in PROD!!
                    //we should implement retry strategy
                    return this.#queue.enqueue(payment);
                }
                break;
            }

            case PaymentProcessor.FALLBACK: {
                if (!(await this.#sendPayment(paymentProcessorName, payment))) {
                    await this.#setPaymentProcessor(PaymentProcessor.DEFAULT);
                    //this could cause infinity loop, but for this tests it should never happen
                    //do not do this in PROD!!
                    //we should implement retry strategy
                    return this.#queue.enqueue(payment);
                }
                break;
            }
        }
    }
}