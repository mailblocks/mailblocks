import { features, type Family, type Platform } from './generated/caniemail';

export {
    families,
    features,
    lastUpdate,
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

/**
 * Support level of a Can I Email feature on a client platform, taken from the
 * latest version Can I Email has tested.
 *
 * Returns `undefined` when Can I Email has no data for that family/platform pair.
 * Throws when `slug` is not a Can I Email feature.
 */
export function support(
    slug: string,
    family: Family,
    platform: Platform,
): SupportLevel | undefined {
    const feature = features[slug];
    if (!feature) throw new Error(`Unknown Can I Email feature: "${slug}"`);
    const entry = feature.stats[family]?.[platform];
    return entry ? (entry[1].charAt(0) as SupportLevel) : undefined;
}
