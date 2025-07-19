export class PaymentSummarizer {
    #redisCacheProvider;

    constructor({ redisCacheProvider }) {
        this.#redisCacheProvider = redisCacheProvider;
    }

    async execute(from, to) {
        const [defaultValues, fallbackValues] = await Promise.all([
            this.#redisCacheProvider.zRangeByScore(
                `transactions:log:DEFAULT`,
                from,
                to
            ),
            this.#redisCacheProvider.zRangeByScore(
                `transactions:log:FALLBACK`,
                from,
                to
            )
        ]);

        let totalAmountDefault = 0;
        for (const defaultValue of defaultValues) {
            totalAmountDefault += JSON.parse(defaultValue).amount;
        }

        let totalAmountFallback = 0;
        for (const fallbackValue of fallbackValues) {
            totalAmountFallback += JSON.parse(fallbackValue).amount;
        }

        return {
            default: {
                totalRequests: defaultValues.length,
                totalAmount: Number(totalAmountDefault.toFixed(1))
            },
            fallback: {
                totalRequests: fallbackValues.length,
                totalAmount: Number(totalAmountFallback.toFixed(1))
            }
        }
    }
}