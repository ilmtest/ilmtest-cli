export type FlowHandler<T> = (value: T) => T | undefined;

/**
 * For each value:
 * - feed it through handlers in order
 * - if a handler returns undefined → handled (stop)
 * - else pass returned value to the next handler
 * If none handled it, call onFallback(finalValue).
 */
export function runFlow<T>(values: Iterable<T>, handlers: FlowHandler<T>[]) {
    for (const original of values) {
        let v: T | undefined = original;

        for (const h of handlers) {
            v = h(v!);

            if (v === undefined) {
                break; // handled
            }
        }
    }
}
