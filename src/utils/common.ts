/**
 * Applies a patch to an array of elements, where the patch can reference
 * properties of the element type T itself.
 */
export function patchArray<T>(
    array: T[],
    patch: ((item: T, index: number, array: T[]) => Partial<T>) | Partial<T>,
): T[] {
    const isFunc = typeof patch === 'function';

    return array.map((item, index, arr) => {
        const patchToApply = isFunc ? patch(item, index, arr) : patch;
        return { ...item, ...patchToApply };
    });
}
