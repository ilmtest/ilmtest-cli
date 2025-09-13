// Assumes sanitizeArabic(...) from your snippet is in scope.
import { sanitizeArabic } from 'bitaboom';

type MatchPolicy = {
    /** Try approximate matches for leftovers (default true). */
    enableFuzzy?: boolean;
    /** Max absolute edit distance accepted in fuzzy (default 3). */
    maxEditAbs?: number;
    /** Max relative edit distance (fraction of excerpt length). Default 0.1 (10%). */
    maxEditRel?: number;
    /** q-gram length for candidate generation (default 4). */
    q?: number;
    /** Max rare grams to seed candidates per excerpt (default 5). */
    gramsPerExcerpt?: number;
    /** Max candidate windows verified per excerpt (default 40). */
    maxCandidatesPerExcerpt?: number;
    /** Seam length for bleed windows (default 512). */
    seamLen?: number;
};

const DEFAULT_POLICY: Required<MatchPolicy> = {
    enableFuzzy: true,
    maxEditAbs: 3,
    maxEditRel: 0.1,
    q: 4,
    gramsPerExcerpt: 5, // widened a bit for robustness
    maxCandidatesPerExcerpt: 40, // widened a bit for robustness
    seamLen: 512,
};

// ------------------------------------------------------------
// 1) Aho–Corasick automaton for multi-pattern substring search
// ------------------------------------------------------------
class ACNode {
    next: Map<string, number> = new Map();
    link = 0;
    out: number[] = [];
}

class AhoCorasick {
    private nodes: ACNode[] = [new ACNode()];

    add(pattern: string, id: number): void {
        let v = 0;
        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern[i];
            let to = this.nodes[v].next.get(ch);
            if (to === undefined) {
                to = this.nodes.length;
                this.nodes[v].next.set(ch, to);
                this.nodes.push(new ACNode());
            }
            v = to;
        }
        this.nodes[v].out.push(id);
    }

    build(): void {
        const q: number[] = [];
        for (const [, to] of this.nodes[0].next) {
            this.nodes[to].link = 0;
            q.push(to);
        }
        while (q.length) {
            const v = q.shift()!;
            for (const [ch, to] of this.nodes[v].next) {
                q.push(to);
                let link = this.nodes[v].link;
                while (link !== 0 && !this.nodes[link].next.has(ch)) {
                    link = this.nodes[link].link;
                }
                const nxt = this.nodes[link].next.get(ch);
                this.nodes[to].link = nxt === undefined ? 0 : nxt;
                this.nodes[to].out = this.nodes[to].out.concat(this.nodes[this.nodes[to].link].out);
            }
        }
    }

    /** Calls onMatch(patternId, endIndexExclusive) for each match. */
    find(text: string, onMatch: (patternId: number, endPos: number) => void): void {
        let v = 0;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            while (v !== 0 && !this.nodes[v].next.has(ch)) {
                v = this.nodes[v].link;
            }
            const to = this.nodes[v].next.get(ch);
            v = to === undefined ? 0 : to;
            if (this.nodes[v].out.length) {
                for (const pid of this.nodes[v].out) {
                    onMatch(pid, i + 1);
                }
            }
        }
    }
}

// ------------------------------------------------------------
// 2) Bounded Levenshtein (banded DP) with early-abort
// ------------------------------------------------------------
function boundedLevenshtein(a: string, b: string, maxDist: number): number {
    const n = a.length,
        m = b.length;
    const big = maxDist + 1;

    if (Math.abs(n - m) > maxDist) {
        return big;
    }
    if (n === 0) {
        return m <= maxDist ? m : big;
    }
    if (m === 0) {
        return n <= maxDist ? n : big;
    }

    // Ensure b is longer
    if (n > m) {
        return boundedLevenshtein(b, a, maxDist);
    }

    const prev = new Int16Array(m + 1);
    const curr = new Int16Array(m + 1);
    for (let j = 0; j <= m; j++) {
        prev[j] = j;
    }

    for (let i = 1; i <= n; i++) {
        const from = Math.max(1, i - maxDist);
        const to = Math.min(m, i + maxDist);

        curr[0] = i;
        let rowMin = curr[0];

        for (let j = 1; j < from; j++) {
            curr[j] = big;
        }

        for (let j = from; j <= to; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const del = prev[j] + 1;
            const ins = curr[j - 1] + 1;
            const sub = prev[j - 1] + cost;
            const val = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
            curr[j] = val;
            if (val < rowMin) {
                rowMin = val;
            }
        }

        for (let j = to + 1; j <= m; j++) {
            curr[j] = big;
        }

        if (rowMin > maxDist) {
            return big;
        }
        for (let j = 0; j <= m; j++) {
            prev[j] = curr[j];
        }
    }
    return prev[m] <= maxDist ? prev[m] : big;
}

// ------------------------------------------------------------
// 3) q-gram inverted index (positions) for fuzzy candidates
// ------------------------------------------------------------
type Posting = { page: number; pos: number; seam: boolean };

class QGramIndex {
    private q: number;
    private map: Map<string, Posting[]> = new Map();
    private gramFreq: Map<string, number> = new Map();

    constructor(q: number) {
        this.q = q;
    }

    addText(page: number, text: string, seam: boolean): void {
        const q = this.q;
        for (let i = 0; i + q <= text.length; i++) {
            const g = text.slice(i, i + q);
            let arr = this.map.get(g);
            if (arr === undefined) {
                arr = [];
                this.map.set(g, arr);
            }
            arr.push({ page, pos: i, seam });
        }
        for (let i = 0; i + q <= text.length; i++) {
            const g = text.slice(i, i + q);
            this.gramFreq.set(g, (this.gramFreq.get(g) ?? 0) + 1);
        }
    }

    /** Pick up to k rare grams that actually exist in the index (with fallback). */
    pickRare(excerpt: string, gramsPerExcerpt: number): { gram: string; offset: number }[] {
        const q = this.q;
        const items: Array<{ gram: string; offset: number; freq: number }> = [];
        const seen = new Set<string>();

        for (let i = 0; i + q <= excerpt.length; i++) {
            const g = excerpt.slice(i, i + q);
            if (seen.has(g)) {
                continue;
            }
            seen.add(g);
            const f = this.gramFreq.get(g) ?? 0x7fffffff;
            items.push({ gram: g, offset: i, freq: f });
        }
        items.sort((a, b) => a.freq - b.freq);

        const out: { gram: string; offset: number }[] = [];
        for (const it of items) {
            if (this.map.has(it.gram)) {
                out.push({ gram: it.gram, offset: it.offset });
                if (out.length >= gramsPerExcerpt) {
                    break;
                }
            }
        }
        if (out.length === 0) {
            for (let i = items.length - 1; i >= 0 && out.length < gramsPerExcerpt; i--) {
                if (this.map.has(items[i].gram)) {
                    out.push({ gram: items[i].gram, offset: items[i].offset });
                }
            }
        }
        return out;
    }

    getPostings(gram: string): Posting[] | undefined {
        return this.map.get(gram);
    }
}

// ------------------------------------------------------------
// 4) Build book with single-space separators; binary-search pages
// ------------------------------------------------------------
function buildBook(pagesN: string[]) {
    const parts: string[] = [];
    const starts: number[] = [];
    const lens: number[] = [];
    let off = 0;

    for (let i = 0; i < pagesN.length; i++) {
        const p = pagesN[i];
        starts.push(off);
        lens.push(p.length);
        parts.push(p);
        off += p.length;

        if (i + 1 < pagesN.length) {
            parts.push(' '); // critical: keep a space between pages so cross-page substrings can match
            off += 1;
        }
    }
    return { book: parts.join(''), starts, lens };
}

function posToPage(pos: number, pageStarts: number[]): number {
    let lo = 0,
        hi = pageStarts.length - 1,
        ans = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (pageStarts[mid] <= pos) {
            ans = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return ans;
}

// ------------------------------------------------------------
// 5) Main API
// ------------------------------------------------------------
export function findMatches(pages: string[], excerpts: string[], policy: MatchPolicy = {}): number[] {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    // Normalize aggressively on both sides (letters + spaces; diacritics/tatweel removed, etc.)
    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

    // Deduplicate excerpts to shrink the AC
    const keyToPatId = new Map<string, number>();
    const patIdToOrigIdxs: number[][] = [];
    const patterns: string[] = [];
    for (let i = 0; i < excerptsN.length; i++) {
        const k = excerptsN[i];
        let pid = keyToPatId.get(k);
        if (pid === undefined) {
            pid = patterns.length;
            keyToPatId.set(k, pid);
            patterns.push(k);
            patIdToOrigIdxs.push([i]);
        } else {
            patIdToOrigIdxs[pid].push(i);
        }
    }

    const { book, starts: pageStarts, lens: pageLens } = buildBook(pagesN);

    // Exact/substring with Aho–Corasick
    const ac = new AhoCorasick();
    for (let pid = 0; pid < patterns.length; pid++) {
        const pat = patterns[pid];
        if (pat.length > 0) {
            ac.add(pat, pid);
        }
    }
    ac.build();

    const result = new Int32Array(excerpts.length).fill(-1);
    const seenExact = new Uint8Array(excerpts.length);

    ac.find(book, (pid, endPos) => {
        const pat = patterns[pid];
        const startPos = endPos - pat.length;
        const startPage = posToPage(startPos, pageStarts);

        // Optional bleed detection if you need it later:
        // const startPageEnd = pageStarts[startPage] + pageLens[startPage];
        // const isBleed = endPos > startPageEnd;

        for (const origIdx of patIdToOrigIdxs[pid]) {
            if (!seenExact[origIdx]) {
                result[origIdx] = startPage; // map to starting page
                seenExact[origIdx] = 1;
            }
        }
    });

    // If everything matched or fuzzy is disabled, return
    let allMatched = true;
    for (let i = 0; i < seenExact.length; i++) {
        if (!seenExact[i]) {
            allMatched = false;
            break;
        }
    }
    if (allMatched || !cfg.enableFuzzy) {
        return Array.from(result);
    }

    // ------------------------------------------------------------
    // Fuzzy recovery: q-gram index per page + seam texts
    // ------------------------------------------------------------
    const qidx = new QGramIndex(cfg.q);
    for (let p = 0; p < pagesN.length; p++) {
        qidx.addText(p, pagesN[p], /*seam*/ false);
    }
    // Seam texts (end of page i + space + start of page i+1)
    const seams: Array<{ text: string; startPage: number }> = [];
    for (let p = 0; p + 1 < pagesN.length; p++) {
        const left = pagesN[p].slice(-cfg.seamLen);
        const right = pagesN[p + 1].slice(0, cfg.seamLen);
        const text = left + ' ' + right; // keep the space!
        seams.push({ text, startPage: p });
        qidx.addText(p, text, /*seam*/ true);
    }

    // Helper: evaluate candidates with a window bounded by maxDist
    const pickBestFuzzy = (
        excerpt: string,
        candidates: Array<{ page: number; start: number; seam: boolean }>,
    ): { page: number; dist: number } | null => {
        const L = excerpt.length;
        if (L === 0) {
            return null;
        }

        const maxDist = Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * L));
        let best: { page: number; dist: number } | null = null;

        const keyset = new Set<string>();
        for (const c of candidates) {
            const k = `${c.page}:${c.start}:${c.seam ? 1 : 0}`;
            if (keyset.has(k)) {
                continue;
            }
            keyset.add(k);

            const src = c.seam ? seams[c.page]?.text : pagesN[c.page];
            if (!src) {
                continue;
            }

            // Window length difference must NOT exceed maxDist, or DP aborts.
            const extra = Math.min(maxDist, Math.max(6, Math.ceil(L * 0.12)));
            const start0 = Math.max(0, c.start - Math.floor(extra / 2));
            const end0 = Math.min(src.length, start0 + L + extra);
            if (end0 <= start0) {
                continue;
            }

            const window = src.slice(start0, end0);

            // Compare excerpt vs entire window (variable length).
            const d = boundedLevenshtein(excerpt, window, maxDist);
            if (d <= maxDist) {
                if (!best || d < best.dist || (d === best.dist && c.page < best.page)) {
                    best = { page: c.page, dist: d };
                    if (d === 0) {
                        break;
                    }
                }
            }
        }
        return best;
    };

    // Fuzzy for leftovers
    for (let i = 0; i < excerptsN.length; i++) {
        if (seenExact[i]) {
            continue;
        }
        const ex = excerptsN[i];
        if (!ex || ex.length < cfg.q) {
            continue;
        }

        const seeds = qidx.pickRare(ex, cfg.gramsPerExcerpt);
        if (seeds.length === 0) {
            continue;
        }

        const allCandidates: Array<{ page: number; start: number; seam: boolean }> = [];
        for (const { gram, offset } of seeds) {
            const posts = qidx.getPostings(gram);
            if (!posts) {
                continue;
            }

            for (const p of posts) {
                const startPos = p.pos - offset; // align gram position to excerpt start
                if (startPos < -Math.floor(ex.length * 0.25)) {
                    continue; // crude guard
                }
                allCandidates.push({ page: p.page, start: Math.max(0, startPos), seam: p.seam });
                if (allCandidates.length >= cfg.maxCandidatesPerExcerpt) {
                    break;
                }
            }
            if (allCandidates.length >= cfg.maxCandidatesPerExcerpt) {
                break;
            }
        }

        if (allCandidates.length === 0) {
            continue;
        }

        const best = pickBestFuzzy(ex, allCandidates);
        if (best) {
            result[i] = best.page;
            seenExact[i] = 1;
        }
    }

    return Array.from(result);
}
