import { slugify } from './slug.util';

describe('slugify', () => {
  it('lowercases and dashes a normal title', () => {
    expect(slugify('Hello Brave New World')).toBe('hello-brave-new-world');
  });

  it('strips accents and punctuation', () => {
    expect(slugify('Café  crème: à la carte!')).toBe('cafe-creme-a-la-carte');
  });

  it('collapses repeated separators and trims dashes', () => {
    expect(slugify('  --NestJS___&&&Prisma--  ')).toBe('nestjs-prisma');
  });

  it('falls back to "post" when nothing usable is left', () => {
    expect(slugify('!!! ??? ***')).toBe('post');
  });

  it('never ends with a dash after truncation', () => {
    expect(slugify('a'.repeat(79) + ' bcd')).toBe('a'.repeat(79));
  });
});
