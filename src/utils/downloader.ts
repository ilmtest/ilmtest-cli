import logger from './logger.js';

export const MEDIA_CONTAINER = 'mp4';

export const downloadYouTubeVideo = async (id: string, outputFile: string): Promise<string> => {
    logger.info(`downloadYouTubeVideo: ${id} to ${outputFile}`);
    const { spawn } = await import('node:child_process');
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const readline = await import('node:readline');

    const outputPath = path.resolve(outputFile);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const outputExt = path.extname(outputPath).replace(/^\./, '') || MEDIA_CONTAINER;
    const outputBase = outputPath.slice(0, outputPath.length - path.extname(outputPath).length);
    const outputTemplate = `${outputBase}.%(ext)s`;
    const expectedOutputPath = `${outputBase}.${outputExt}`;

    const target = /^https?:\/\//.test(id) ? id : `https://www.youtube.com/watch?v=${id}`;

    return new Promise<string>((resolve, reject) => {
        // Prefer MP4 video + M4A audio to avoid conversion; fall back gracefully if unavailable.
        const args = [
            '--no-playlist',
            '--newline',
            '--progress',
            '-f',
            'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
            '--merge-output-format',
            outputExt,
            '-o',
            outputTemplate,
            target,
        ];

        const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

        let stderr = '';

        const stdoutRl = readline.createInterface({ input: proc.stdout });
        stdoutRl.on('line', (line) => {
            const trimmed = line.trim();
            if (trimmed) {
                logger.info(trimmed);
            }
        });

        const stderrRl = readline.createInterface({ input: proc.stderr });
        stderrRl.on('line', (line) => {
            stderr += `${line}\n`;
            const trimmed = line.trim();
            if (trimmed) {
                // yt-dlp sends progress/status mostly to stdout; stderr is usually warnings/errors.
                logger.warn(trimmed);
            }
        });

        proc.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        proc.on('error', (error: any) => {
            stdoutRl.close();
            stderrRl.close();
            reject(
                new Error(
                    `Failed to spawn yt-dlp. Make sure it is installed and on your PATH. Original error: ${error?.message ?? error}`,
                ),
            );
        });

        proc.on('close', async (code) => {
            stdoutRl.close();
            stderrRl.close();
            if (code === 0) {
                // yt-dlp may still write a different extension depending on merge support; prefer expected path if it exists.
                const expected = Bun.file(expectedOutputPath);
                if (await expected.exists()) {
                    resolve(expectedOutputPath);
                } else {
                    // Fallback: return the requested output path; callers generally expect .mp4 anyway.
                    resolve(outputPath);
                }
            } else {
                reject(new Error(`yt-dlp failed for ${target}: ${stderr || `exit code ${code}`}`));
            }
        });
    });
};
