import { check, type CompatWarning, type Target } from './check';
import { familyNames, features, platformNames, type Family, type Platform } from './compat';
import type { EmailDocument } from './model';

/**
 * How well a document renders in one client:
 * - `ok`: nothing to report.
 * - `unknown`: Can I Email has no data for some of the styles used.
 * - `partial`: some styles are only partly supported.
 * - `unsupported`: some styles do not work at all.
 */
export type ClientStatus = 'ok' | 'unknown' | 'partial' | 'unsupported';

export interface ClientResult {
    target: Target;
    /** Display name, e.g. "Outlook Windows" or "Apple Mail iOS". */
    name: string;
    status: ClientStatus;
    warnings: CompatWarning[];
}

let everyTarget: Target[] | undefined;

/** Every email client Can I Email has data for, sorted by display name. */
export function allTargets(): Target[] {
    if (!everyTarget) {
        const seen = new Map<string, Target>();
        for (const feature of Object.values(features)) {
            for (const [family, byPlatform] of Object.entries(feature.stats)) {
                for (const platform of Object.keys(byPlatform ?? {})) {
                    seen.set(`${family}/${platform}`, {
                        family: family as Family,
                        platform: platform as Platform,
                    });
                }
            }
        }
        everyTarget = [...seen.values()].sort((a, b) => targetName(a).localeCompare(targetName(b)));
    }
    return [...everyTarget];
}

/** Display name of a client, e.g. "Gmail Android", or "Outlook.com" rather than "Outlook Outlook.com". */
export function targetName(target: Target): string {
    const family = familyNames[target.family];
    const platform = platformNames[target.platform];
    return platform.toLowerCase().includes(family.toLowerCase())
        ? platform
        : `${family} ${platform}`;
}

/**
 * Checks the document against each client separately and rates it, so a UI
 * can show where the email renders fine and where it has problems. Defaults
 * to every client Can I Email knows about.
 */
export function clientReport(
    doc: EmailDocument,
    targets: readonly Target[] = allTargets(),
): ClientResult[] {
    return targets.map((target) => {
        const warnings = check(doc, [target]);
        return { target, name: targetName(target), status: statusOf(warnings), warnings };
    });
}

function statusOf(warnings: readonly CompatWarning[]): ClientStatus {
    if (warnings.some((w) => w.level === 'n')) return 'unsupported';
    if (warnings.some((w) => w.level === 'a')) return 'partial';
    if (warnings.some((w) => w.level === 'u')) return 'unknown';
    return 'ok';
}
