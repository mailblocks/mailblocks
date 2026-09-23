import { features, type Family, type Platform } from './generated/caniemail';

export {
    families,
    familyNames,
    features,
    lastUpdate,
    platformNames,
    platforms,
    type Family,
    type Feature,
    type Platform,
} from './generated/caniemail';

/**
 * Can I Email support level:
 * `y` supported, `n` not supported, `a` partially supported, `u` unknown.
 */
export type SupportLevel = 'y' | 'n' | 'a' | 'u';

export interface SupportDetails {
    level: SupportLevel;
    /** Client version Can I Email tested last, e.g. "2025-11" or "16.80". */
    version: string;
    /** Footnotes Can I Email attached to that result, e.g. what "partial" means. */
    notes: string[];
}

/**
 * Support of a Can I Email feature on a client platform, taken from the latest
 * version Can I Email has tested.
 *
 * Returns `undefined` when Can I Email has no data for that family/platform pair.
 * Throws when `slug` is not a Can I Email feature.
 */
export function supportDetails(
    slug: string,
    family: Family,
    platform: Platform,
): SupportDetails | undefined {
    const feature = features[slug];
    if (!feature) throw new Error(`Unknown Can I Email feature: "${slug}"`);
    const entry = feature.stats[family]?.[platform];
    if (!entry) return undefined;
    const [version, raw] = entry;
    const notes = [...raw.matchAll(/#(\d+)/g)]
        .map((match) => feature.notes[match[1] ?? ''])
        .filter((note): note is string => note !== undefined);
    return { level: raw.charAt(0) as SupportLevel, version, notes };
}

/** Support level only. See {@link supportDetails}. */
export function support(
    slug: string,
    family: Family,
    platform: Platform,
): SupportLevel | undefined {
    return supportDetails(slug, family, platform)?.level;
}
