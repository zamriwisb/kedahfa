export interface Slide {
  id: string;
  /** Public-absolute path, e.g. "/images/slides/tickets.jpg". */
  image: string;
  /** Describes the photo, not the headline. Never optional. */
  imageAlt: string;
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
