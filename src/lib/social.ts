import {
  faFacebookF,
  faInstagram,
  faLinkedinIn,
  faSnapchat,
  faTiktok,
  faWhatsapp,
  faXTwitter,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/free-brands-svg-icons';

/**
 * Font Awesome is used as a build-time source of icon geometry, not as a
 * webfont. Each import above is an object whose `icon` tuple is
 * [width, height, ligatures, unicode, pathData], so the only thing that
 * reaches the browser is the path string for the handful of platforms
 * club.yaml actually lists — Vite drops the rest of the pack. The webfont
 * distribution would have added a fourth self-hosted font file to
 * BaseLayout's preloads to render six glyphs.
 *
 * These are the "-f"/"-in" marks (faFacebookF, faLinkedinIn) rather than the
 * squared variants: the footer draws its own circle around each one, and a
 * glyph that carries its own container would sit as a square inside a ring.
 */
const ICONS = {
  facebook: faFacebookF,
  instagram: faInstagram,
  linkedin: faLinkedinIn,
  snapchat: faSnapchat,
  tiktok: faTiktok,
  whatsapp: faWhatsapp,
  x: faXTwitter,
  youtube: faYoutube,
} satisfies Record<string, IconDefinition>;

/** Names a content editor may reasonably write for a platform already above. */
const ALIASES: Record<string, keyof typeof ICONS> = {
  twitter: 'x',
  'facebook-f': 'facebook',
  'x (twitter)': 'x',
  youtube: 'youtube',
};

export const SUPPORTED_PLATFORMS = Object.keys(ICONS).sort();

export interface SocialIcon {
  width: number;
  height: number;
  path: string;
}

/**
 * Resolves a platform name from club.yaml to its icon geometry.
 *
 * Throws when the name is unrecognised. The header this replaced fell back to
 * a generic globe path, so misspelling a platform in club.yaml shipped a
 * meaningless circle that nobody would notice in review. Every other content
 * error in this project fails the build (assertReferencesResolve,
 * assertPublicAssetsExist); an icon that cannot be drawn is the same class of
 * problem and gets the same treatment.
 */
export function socialIcon(platform: string): SocialIcon {
  const key = platform.trim().toLowerCase();
  const resolved = ICONS[key as keyof typeof ICONS] ?? ICONS[ALIASES[key]];

  if (!resolved) {
    throw new Error(
      `Unknown social platform "${platform}" in src/data/club.yaml. ` +
        `Supported: ${SUPPORTED_PLATFORMS.join(', ')}. ` +
        `To add another, import its icon in src/lib/social.ts.`,
    );
  }

  const [width, height, , , path] = resolved.icon;
  return { width, height, path: Array.isArray(path) ? path[0] : path };
}
