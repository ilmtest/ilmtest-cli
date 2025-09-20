/**
 * Applies a patch to an array of elements, where the patch can reference
 * properties of the element type T itself.
 *
 * @template T - The type of elements in the array
 * @param array - The array of elements to patch
 * @param patch - Either a partial object to apply to all elements, or a function that returns a partial object for each element
 * @returns A new array with the patch applied to each element
 *
 * @example
 * ```typescript
 * // Using a static patch object
 * const users = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
 * const updatedUsers = patchArray(users, { active: true });
 * // Result: [{ id: 1, name: 'John', active: true }, { id: 2, name: 'Jane', active: true }]
 *
 * // Using a function patch
 * const numberedUsers = patchArray(users, (item, index) => ({ order: index + 1 }));
 * // Result: [{ id: 1, name: 'John', order: 1 }, { id: 2, name: 'Jane', order: 2 }]
 * ```
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
