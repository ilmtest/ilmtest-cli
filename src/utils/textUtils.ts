export const convertArabicIndicToRoman = (text: string) => {
    // Create formatters
    const romanFormatter = new Intl.NumberFormat('en', { numberingSystem: 'roman' });

    // Process each line
    return text
        .split('\n')
        .map((line) => {
            // Find Arabic-Indic digit sequences at the beginning of the line
            return line.replace(/^([٠-٩]+)/, (match) => {
                // Convert Arabic-Indic digits to regular digits using Unicode arithmetic
                const num = parseInt(
                    match.replace(/[٠-٩]/g, (digit) => {
                        return String.fromCharCode(digit.charCodeAt(0) - '٠'.charCodeAt(0) + '0'.charCodeAt(0));
                    }),
                    10,
                );

                // Use Intl to format as Roman numerals
                return romanFormatter.format(num).toUpperCase();
            });
        })
        .join('\n');
};
