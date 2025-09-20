/**
 * Type definition for flow handlers that process values and return continuation signals
 * @template T - Type of values being processed
 * @template Args - Type of additional arguments passed to handlers
 */
type FlowHandler<T, Args extends readonly unknown[] = []> = (
    value: T,
    ...args: Args
) => true | (false | null | undefined | void | 0 | '');

/**
 * Runs a series of handlers on an iterable of values in a flow pattern
 * Each value is processed by handlers sequentially until one returns true (indicating completion)
 * @template T - Type of values in the iterable
 * @template Args - Type of additional arguments
 * @param values - Iterable of values to process
 * @param handlers - Array of handler functions to apply to each value
 * @param args - Additional arguments to pass to each handler
 * @returns The args parameter (for chaining or reference)
 */
export function runFlow<T, Args extends readonly unknown[]>(
    values: Iterable<T>,
    handlers: FlowHandler<T, Args>[],
    ...args: Args
): Args {
    for (const value of values) {
        for (const h of handlers) {
            const result = h(value, ...args);

            if (result === true) {
                break; // Handler signaled "done" - stop processing this value
            }
        }
    }
    return args;
}
