import { describe, expect, it } from 'bun:test';
import { mapPatternsToFormatters } from './textUtils';

describe('textUtils', () => {
    describe('mapPatternsToFormatters', () => {
        describe('pattern: ^[\\u0660-\\u0669]+\\s?[-–—ـ] (Arabic numeral followed by optional space and dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove single Arabic numeral with hyphen', () => {
                expect(format('١- نص عربي')).toBe(' نص عربي');
            });

            it('should remove single Arabic numeral with space and hyphen', () => {
                expect(format('٢ - نص عربي')).toBe(' نص عربي');
            });

            it('should remove multiple Arabic numerals with hyphen', () => {
                expect(format('١٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with en dash', () => {
                expect(format('٣– نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with em dash', () => {
                expect(format('٤— نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with tatweel', () => {
                expect(format('٥ـ نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+ [أ-ي]\\s?[-–—ـ] (Arabic numeral, space, Arabic letter, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+ [أ-ي]\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove Arabic numeral with letter alef and hyphen', () => {
                expect(format('١ أ- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with letter ba and space hyphen', () => {
                expect(format('٢ ب – نص عربي')).toBe(' نص عربي');
            });

            it('should remove multiple Arabic numerals with letter jim and hyphen', () => {
                expect(format('١٢ ج- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with letter ya and en dash', () => {
                expect(format('٣ ي– نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^°\\*? [\\u0660-\\u0669]+\\s?[-–—ـ] (degree symbol, optional asterisk, space, Arabic numeral, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^°\\*? [\\u0660-\\u0669]+\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove degree symbol with Arabic numeral and hyphen', () => {
                expect(format('° ١- نص عربي')).toBe(' نص عربي');
            });

            it('should remove degree symbol with asterisk, Arabic numeral and hyphen', () => {
                expect(format('°* ٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove degree symbol with multiple Arabic numerals and space hyphen', () => {
                expect(format('° ١٢ – نص عربي')).toBe(' نص عربي');
            });

            it('should remove degree symbol with asterisk and en dash', () => {
                expect(format('°* ٣– نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+\\s?[-–—ـ] \\([\\u0660-\\u0669]+\\) (Arabic numeral, dash, parenthesized Arabic numeral)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s?[-–—ـ] \\([\\u0660-\\u0669]+\\)': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove Arabic numeral with hyphen and parenthesized numeral', () => {
                expect(format('١- (٢) نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with space hyphen and parenthesized numeral', () => {
                expect(format('١ - (٢) نص عربي')).toBe(' نص عربي');
            });

            it('should remove multiple Arabic numerals with en dash and parenthesized numerals', () => {
                expect(format('١٢– (٣٤) نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with space en dash and parenthesized numeral', () => {
                expect(format('١ – (٢) نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+/ [\\u0660-\\u0669]+\\s?[-–—ـ] (Arabic numeral, slash space, Arabic numeral, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+/ [\\u0660-\\u0669]+\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove Arabic numerals with slash space and hyphen', () => {
                expect(format('١/ ٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numerals with slash space and space hyphen', () => {
                expect(format('١/ ٢ – نص عربي')).toBe(' نص عربي');
            });

            it('should remove multiple Arabic numerals with slash space', () => {
                expect(format('١٢/ ٣٤- نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^\\([\\u0660-\\u0669]+\\)  (parenthesized Arabic numeral with space)', () => {
            const formatters = mapPatternsToFormatters({
                '^\\([\\u0660-\\u0669]+\\) ': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove parenthesized single Arabic numeral with space', () => {
                expect(format('(١) نص عربي')).toBe('نص عربي');
            });

            it('should remove parenthesized multiple Arabic numerals with space', () => {
                expect(format('(١٢) نص عربي')).toBe('نص عربي');
            });

            it('should remove parenthesized Arabic numeral at start only', () => {
                expect(format('(٣) بداية (٤) وسط')).toBe('بداية (٤) وسط');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+?:، ?[\\u0660-\\u0669]+\\s?[-–—ـ] (Arabic numeral, colon, Arabic comma, numeral, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+?:، ?[\\u0660-\\u0669]+\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove Arabic numeral with colon, Arabic comma, space and hyphen', () => {
                expect(format('١:، ٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with colon, Arabic comma without space', () => {
                expect(format('٢:،٣- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with colon, Arabic comma and en dash', () => {
                expect(format('١:، ٢– نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with colon, Arabic comma and space dash', () => {
                expect(format('١:، ٢ – نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+ ?/ ?[\\u0660-\\u0669]+\\s?[-–—ـ] (Arabic numeral, optional spaces around slash, numeral, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+ ?/ ?[\\u0660-\\u0669]+\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove Arabic numerals with slash no spaces and hyphen', () => {
                expect(format('١/٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numerals with space before slash', () => {
                expect(format('١ /٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numerals with space after slash', () => {
                expect(format('١/ ٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numerals with spaces around slash', () => {
                expect(format('١ / ٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numerals with slash and space hyphen', () => {
                expect(format('١/٢ – نص عربي')).toBe(' نص عربي');
            });

            it('should remove multiple Arabic numerals with slash and en dash', () => {
                expect(format('١٢/٣٤– نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+(?: ?/ ?[\\u0660-\\u0669]*[أ-ي])?\\s?[-–—ـ]\\s* (Arabic numeral with optional slash and letter, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+(?: ?/ ?[\\u0660-\\u0669]*[أ-ي])?\\s?[-–—ـ]\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove single Arabic numeral with hyphen', () => {
                expect(format('١- نص عربي')).toBe('نص عربي');
            });

            it('should remove Arabic numeral with hyphen and trailing space', () => {
                expect(format('٢-  نص عربي')).toBe('نص عربي');
            });

            it('should remove Arabic numeral with slash and letter', () => {
                expect(format('١/أ- نص عربي')).toBe('نص عربي');
            });

            it('should remove Arabic numeral with space slash space and letter', () => {
                expect(format('١ / أ- نص عربي')).toBe('نص عربي');
            });

            it('should remove Arabic numeral with slash, numerals and letter', () => {
                expect(format('١/٢أ- نص عربي')).toBe('نص عربي');
            });

            it('should remove Arabic numeral with space slash numerals and letter with en dash', () => {
                expect(format('٣ /١٢ب– نص عربي')).toBe('نص عربي');
            });

            it('should remove Arabic numeral with em dash and trailing whitespace', () => {
                expect(format('٤—  نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+(?:، [\\u0660-\\u0669]+)*\\s?[-–—ـ]\\s* (Arabic numerals with comma separation, dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+(?:، [\\u0660-\\u0669]+)*\\s?[-–—ـ]\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove single Arabic numeral with hyphen', () => {
                expect(format('١- نص عربي')).toBe('نص عربي');
            });

            it('should remove two comma-separated Arabic numerals with hyphen', () => {
                expect(format('١، ٢- نص عربي')).toBe('نص عربي');
            });

            it('should remove three comma-separated Arabic numerals with hyphen', () => {
                expect(format('١، ٢، ٣- نص عربي')).toBe('نص عربي');
            });

            it('should remove comma-separated Arabic numerals with space hyphen', () => {
                expect(format('١، ٢ – نص عربي')).toBe('نص عربي');
            });

            it('should remove comma-separated Arabic numerals with trailing whitespace', () => {
                expect(format('١، ٢، ٣–  نص عربي')).toBe('نص عربي');
            });

            it('should remove multiple digit Arabic numerals with comma separation', () => {
                expect(format('١٢، ٣٤، ٥٦- نص عربي')).toBe('نص عربي');
            });

            it('should remove comma-separated numerals with em dash', () => {
                expect(format('١، ٢— نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^\\[[\u0660-\u0669]+\\]  (square bracketed Arabic numeral with space)', () => {
            const formatters = mapPatternsToFormatters({
                '^\\[[\\u0660-\\u0669]+\\] ': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove square bracketed single Arabic numeral with space', () => {
                expect(format('[١] نص عربي')).toBe('نص عربي');
            });

            it('should remove square bracketed multiple Arabic numerals with space', () => {
                expect(format('[١٢] نص عربي')).toBe('نص عربي');
            });

            it('should remove square bracketed Arabic numeral at start only', () => {
                expect(format('[٣] بداية [٤] وسط')).toBe('بداية [٤] وسط');
            });
        });

        describe('pattern: \\* (asterisk removal)', () => {
            const formatters = mapPatternsToFormatters({
                '\\*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove single asterisk', () => {
                expect(format('نص* عربي')).toBe('نص عربي');
            });

            it('should remove multiple asterisks', () => {
                expect(format('*نص* *عربي*')).toBe('نص عربي');
            });

            it('should remove asterisk at start', () => {
                expect(format('* نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^• (bullet point)', () => {
            const formatters = mapPatternsToFormatters({
                '^•': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove bullet point at start', () => {
                expect(format('• نص عربي')).toBe(' نص عربي');
            });

            it('should remove bullet point without space', () => {
                expect(format('•نص عربي')).toBe('نص عربي');
            });

            it('should not remove bullet point in middle of text', () => {
                expect(format('نص • عربي')).toBe('نص • عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+\\s*[-–—ـ] (Arabic numeral with flexible whitespace and dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s*[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove Arabic numeral with no space before dash', () => {
                expect(format('١- نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with multiple spaces before dash', () => {
                expect(format('٢   - نص عربي')).toBe(' نص عربي');
            });

            it('should remove Arabic numeral with tab before dash', () => {
                expect(format('٣\t– نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^\\([\\u0660-\\u0669]+\\)\\s*\\([\\u0660-\\u0669]+\\)\\s* (double parenthesized numerals)', () => {
            const formatters = mapPatternsToFormatters({
                '^\\([\\u0660-\\u0669]+\\)\\s*\\([\\u0660-\\u0669]+\\)\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove two parenthesized numerals with space between', () => {
                expect(format('(١) (٢) نص عربي')).toBe('نص عربي');
            });

            it('should remove two parenthesized numerals without space between', () => {
                expect(format('(١)(٢) نص عربي')).toBe('نص عربي');
            });

            it('should remove two parenthesized numerals with multiple spaces', () => {
                expect(format('(١٢)  (٣٤)  نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^\\([\\u0660-\\u0669]+\\)\\s* (parenthesized numeral with optional whitespace)', () => {
            const formatters = mapPatternsToFormatters({
                '^\\([\\u0660-\\u0669]+\\)\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove parenthesized numeral with space', () => {
                expect(format('(١) نص عربي')).toBe('نص عربي');
            });

            it('should remove parenthesized numeral without space', () => {
                expect(format('(٢)نص عربي')).toBe('نص عربي');
            });

            it('should remove parenthesized numeral with multiple spaces', () => {
                expect(format('(٣)   نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+\\s*\\([\\u0600-\\u06FF\\u0660-\\u0669\\s]+\\)\\s*[-–—ـ]\\s* (numeral with Arabic/numerals in parens then dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s*\\([\\u0600-\\u06FF\\u0660-\\u0669\\s]+\\)\\s*[-–—ـ]\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove numeral with Arabic text in parens and dash', () => {
                expect(format('١ (باب) - نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral with Arabic numerals in parens and dash', () => {
                expect(format('١ (٢٣) – نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral with mixed content in parens', () => {
                expect(format('٢(كتاب ١)- نص عربي')).toBe('نص عربي');
            });

            it('should remove with trailing whitespace after dash', () => {
                expect(format('٣ (فصل) –  نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+\\s*[-–—ـ]\\s*[\\u0660-\\u0669]+\\s*[-–—ـ] (double numeral-dash pattern)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s*[-–—ـ]\\s*[\\u0660-\\u0669]+\\s*[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove double numeral-dash with spaces', () => {
                expect(format('١ - ٢ - نص عربي')).toBe(' نص عربي');
            });

            it('should remove double numeral-dash without spaces', () => {
                expect(format('١-٢- نص عربي')).toBe(' نص عربي');
            });

            it('should remove double numeral-dash with en dashes', () => {
                expect(format('٣–٤– نص عربي')).toBe(' نص عربي');
            });

            it('should remove double numeral-dash with mixed dashes', () => {
                expect(format('١ – ٢— نص عربي')).toBe(' نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+\\s*\\([\\u0600-\\u06FF]+\\)\\s*[-–—ـ]\\s* (numeral with Arabic-only in parens and dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s*\\([\\u0600-\\u06FF]+\\)\\s*[-–—ـ]\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove numeral with Arabic word in parens and dash', () => {
                expect(format('١ (باب) - نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral with Arabic word in parens no spaces', () => {
                expect(format('٢(كتاب)- نص عربي')).toBe('نص عربي');
            });

            it('should remove with trailing whitespace', () => {
                expect(format('٣ (فصل) –  نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+\\s*[-–—ـ]\\s*\\([^)]+\\)\\s* (numeral, dash, anything in parens)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+\\s*[-–—ـ]\\s*\\([^)]+\\)\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove numeral, dash, Arabic text in parens', () => {
                expect(format('١ - (باب الصلاة) نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral, dash, numerals in parens', () => {
                expect(format('٢- (123) نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral, dash, mixed content in parens', () => {
                expect(format('٣ – (Page 5) نص عربي')).toBe('نص عربي');
            });

            it('should remove with trailing whitespace', () => {
                expect(format('٤—(تابع)  نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+ حدَّثنا replacement (numeral before حدَّثنا)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+ حدَّثنا': 'حدَّثنا',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should replace numeral before حدَّثنا keeping حدَّثنا', () => {
                expect(format('١ حدَّثنا محمد')).toBe('حدَّثنا محمد');
            });

            it('should replace multiple digit numeral before حدَّثنا', () => {
                expect(format('١٢٣ حدَّثنا أحمد')).toBe('حدَّثنا أحمد');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+ - حدَّثنا replacement (numeral with dash before حدَّثنا)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+ - حدَّثنا': 'حدَّثنا',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should replace numeral with dash before حدَّثنا keeping حدَّثنا', () => {
                expect(format('١ - حدَّثنا محمد')).toBe('حدَّثنا محمد');
            });

            it('should replace multiple digit numeral with dash before حدَّثنا', () => {
                expect(format('٤٥ - حدَّثنا علي')).toBe('حدَّثنا علي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+/\\s*[\\u0660-\\u0669]+\\s*[-–—ـ]\\s* (numeral slash numeral with flexible spacing)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+/\\s*[\\u0660-\\u0669]+\\s*[-–—ـ]\\s*': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove numeral slash numeral with no spaces', () => {
                expect(format('١/٢- نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral slash numeral with space after slash', () => {
                expect(format('١/ ٢- نص عربي')).toBe('نص عربي');
            });

            it('should remove numeral slash numeral with spaces and trailing whitespace', () => {
                expect(format('٣/ ٤ –  نص عربي')).toBe('نص عربي');
            });

            it('should remove multiple digit numerals with slash', () => {
                expect(format('١٢/٣٤– نص عربي')).toBe('نص عربي');
            });
        });

        describe('pattern: ^[\\u0660-\\u0669]+ م\\s?[-–—ـ] (numeral with م and dash)', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+ م\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should remove numeral with م and hyphen', () => {
                expect(format('١ م- نص عربي')).toBe(' نص عربي');
            });

            it('should remove numeral with م and space hyphen', () => {
                expect(format('٢ م - نص عربي')).toBe(' نص عربي');
            });

            it('should remove numeral with م and en dash', () => {
                expect(format('٣ م– نص عربي')).toBe(' نص عربي');
            });

            it('should remove multiple digit numeral with م', () => {
                expect(format('١٢٣ م- نص عربي')).toBe(' نص عربي');
            });
        });

        describe('combined patterns', () => {
            const formatters = mapPatternsToFormatters({
                '^[\\u0660-\\u0669]+ ?/ ?[\\u0660-\\u0669]+\\s?[-–—ـ]': '',
                '^[\\u0660-\\u0669]+ [أ-ي]\\s?[-–—ـ]': '',
                '^[\\u0660-\\u0669]+?:، ?[\\u0660-\\u0669]+\\s?[-–—ـ]': '',
                '^[\\u0660-\\u0669]+(?: ?/ ?[\\u0660-\\u0669]*[أ-ي])?\\s?[-–—ـ]\\s*': '',
                '^[\\u0660-\\u0669]+(?:، [\\u0660-\\u0669]+)*\\s?[-–—ـ]\\s*': '',
                '^[\\u0660-\\u0669]+/ [\\u0660-\\u0669]+\\s?[-–—ـ]': '',
                '^[\\u0660-\\u0669]+\\s?[-–—ـ]': '',
                '^[\\u0660-\\u0669]+\\s?[-–—ـ] \\([\\u0660-\\u0669]+\\)': '',
                '^\\([\\u0660-\\u0669]+\\) ': '',
                '^°\\*? [\\u0660-\\u0669]+\\s?[-–—ـ]': '',
            });
            const format = (text: string) => formatters.reduce((t, f) => f(t), text);

            it('should apply first matching formatter and remove prefix marker', () => {
                // First pattern "^[\u0660-\u0669]+\s?[-–—ـ]" matches "١-" and removes it
                expect(format('١- نص عربي')).toBe('نص عربي');
            });

            it('should not modify text without matching pattern', () => {
                expect(format('نص عربي بدون رقم')).toBe('نص عربي بدون رقم');
            });
        });
    });
});
