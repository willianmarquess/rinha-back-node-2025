import { PaymentProcessor } from "./enums/PaymentProcessor.js";
import { fetchWithTimeout } from "./utils/fetchWithTimeout.js";

const PAYMENT_PROCESSOR_TIMEOUT = 10_000;

export class PaymentSender {
    #redisCacheProvider;
    #config;

    constructor({ redisCacheProvider, config }) {
        this.#redisCacheProvider = redisCacheProvider;
        this.#config = config;
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

        /**
         * The correct thing would be to validate whether it is a contract error, 
         * if so save it to the database to analyze the problem and not retry, 
         * as it will cause an infinite loop.
         * But for now, it should never happen
         */

        return false;
    }

    async execute(payment, retry = 0) {
        //This should never happen
        if (retry >= 20) {
            console.log(`Discart payment: `, payment);
            return;
        }

        const paymentProcessorName = await this.#getPaymentProcessor();

        switch (paymentProcessorName) {
            case PaymentProcessor.DEFAULT: {
                if (!(await this.#sendPayment(paymentProcessorName, payment))) {
                    if(retry >= 15) {
                        await this.#setPaymentProcessor(PaymentProcessor.FALLBACK);
                    }
                    return this.execute(payment, retry + 1);
                }
                break;
            }

            case PaymentProcessor.FALLBACK: {
                if (!(await this.#sendPayment(paymentProcessorName, payment))) {
                    return this.execute(payment, retry + 1);
                }
                break;
            }
        }
    }
}