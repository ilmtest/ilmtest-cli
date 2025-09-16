type FlowHandler<T, Args extends readonly unknown[] = []> = (
    value: T,
    ...args: Args
) => true | (false | null | undefined | void | 0 | '');

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
