import { describe, expect, it } from 'bun:test';

import { mapIndexToMatn } from './utils';

describe('utils', () => {
    describe('mapIndexToMatn', () => {
        it('should map the content from the 3 pages', () => {
            const pages = [
                ['7929 - 3023 - A', 'EFG".'].join('\n'),
                '(صحيح) [خ] عن عائشة.',
                '7938 - 3032 - ABC.',
                '4762 - x y\nz',
            ];

            const actual = mapIndexToMatn(pages);
            expect(actual).toEqual({
                '4762': 'x y\nz',
                '7929': 'A\nEFG".\n(صحيح) [خ] عن عائشة.',
                '7938': 'ABC.',
            });
        });

        it('should handle the translations', () => {
            const pages = [
                '7922 – 3016 – “O Aisha',
                '8097 – 3178 – "Every greeting',
                '(Ṣaḥīḥ) [حم طب] ʿan Ibn ʿUmar.',
                '8195 – "The upper',
            ];

            const actual = mapIndexToMatn(pages);

            expect(actual).toEqual({
                '7922': '“O Aisha',
                '8097': '"Every greeting\n(Ṣaḥīḥ) [حم طب] ʿan Ibn ʿUmar.',
                '8195': '"The upper',
            });
        });

        it('should work on the typo variation', () => {
            const pages = [
                `87  1 -[أتدرون ما المفلس؟ إن المفلس من أمتي من يأتي يوم القيامة بصلاة وصيام وزكاة ويأتي قد شتم هذا وقذف هذا وأكل مال هذا وسفك دم هذا وضرب هذا فيعطى هذا من حسناته وهذا من حسناته فإن فنيت حسناته قبل أن يقضى ما عليه أخذ من خطاياهم فطرحت عليه ثم طرح في النار].
(صحيح) … [حم، ت] عن أبي هريرة. الصحيحة 847، ومختصر مسلم 1836.`,
            ];

            const actual = mapIndexToMatn(pages);

            expect(actual).toEqual({
                '87': '1 -[أتدرون ما المفلس؟ إن المفلس من أمتي من يأتي يوم القيامة بصلاة وصيام وزكاة ويأتي قد شتم هذا وقذف هذا وأكل مال هذا وسفك دم هذا وضرب هذا فيعطى هذا من حسناته وهذا من حسناته فإن فنيت حسناته قبل أن يقضى ما عليه أخذ من خطاياهم فطرحت عليه ثم طرح في النار].\n(صحيح) … [حم، ت] عن أبي هريرة. الصحيحة 847، ومختصر مسلم 1836.',
            });
        });
    });
});
