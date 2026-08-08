export interface Slide {
  id: string;
  /** Public-absolute path, e.g. "/images/slides/tickets.jpg". */
  image: string;
  /** Describes the photo, not the headline. Never optional. */
  imageAlt: string;
  /**
   * Where `object-cover` anchors the crop when the hero box and the source
   * disagree on aspect — which they always do below `xl`, where the box is
   * taller than it is wide. Omit it for a centred subject; set it for an
   * image composed off-centre, such as an announcement graphic whose player
   * stands to one side. A closed set rather than a free CSS string: the value
   * lands in a style attribute, so the schema's enum is the injection guard.
   */
  objectPosition?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  /** Short line above the headline — a date or a label. */
  eyebrow?: string;
  title: string;
  href?: string;
  /** Button label. Meaningless without `href`; the schema enforces the pair. */
  cta?: string;
  order?: number;
}

/**
 * Ascending by `order`, with slides that have none falling after every slide
 * that does. Promoting one slide is then a single-line YAML edit rather than a
 * renumbering of the whole file.
 *
 * Array.prototype.sort is specified as stable in modern engines, but the
 * decorate-sort-undecorate below makes that guarantee explicit rather than
 * assumed: two slides sharing an order value must never swap between builds,
 * or the homepage's opening slide changes at random.
 */
export function sortSlides(slides: Slide[]): Slide[] {
  return slides
    .map((slide, index) => ({ slide, index }))
    .sort((a, b) => {
      const left = a.slide.order ?? Number.POSITIVE_INFINITY;
      const right = b.slide.order ?? Number.POSITIVE_INFINITY;
      return left === right ? a.index - b.index : left - right;
    })
    .map((entry) => entry.slide);
}
