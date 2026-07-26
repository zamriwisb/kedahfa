import { describe, expect, it } from 'vitest';
import { sortSlides, type Slide } from '../../src/lib/slides';

const slide = (id: string, order?: number): Slide => ({
  id,
  image: '/images/slides/example.jpg',
  imageAlt: `${id} photo`,
  title: id,
  order,
});

const ids = (slides: Slide[]) => slides.map((s) => s.id);

describe('sortSlides', () => {
  it('orders slides by their order field, ascending', () => {
    expect(ids(sortSlides([slide('c', 3), slide('a', 1), slide('b', 2)]))).toEqual(['a', 'b', 'c']);
  });

  it('puts slides with no order after every slide that has one', () => {
    expect(ids(sortSlides([slide('plain'), slide('first', 1)]))).toEqual(['first', 'plain']);
  });

  it('keeps file order among slides that share an order value', () => {
    // Two slides both marked `order: 1` must not swap on every build — a
    // non-stable sort here would make the homepage's opening slide random.
    expect(ids(sortSlides([slide('x', 1), slide('y', 1), slide('z', 1)]))).toEqual(['x', 'y', 'z']);
  });

  it('keeps file order among slides that all lack an order', () => {
    expect(ids(sortSlides([slide('x'), slide('y'), slide('z')]))).toEqual(['x', 'y', 'z']);
  });

  it('returns an empty array unchanged', () => {
    expect(sortSlides([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [slide('b', 2), slide('a', 1)];
    sortSlides(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });
});
