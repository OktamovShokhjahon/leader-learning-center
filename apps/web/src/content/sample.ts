/**
 * ⚠️  SAMPLE CONTENT SWITCH — READ BEFORE LAUNCH
 *
 * Parts of this site make claims about real people: student exam results,
 * testimonials, and teacher names and credentials. Until the centre supplies
 * the real ones, those sections are filled with **sample data** so the site can
 * be reviewed and demonstrated as a finished product.
 *
 * Sample data must not be published as fact. Publishing invented IELTS bands or
 * a testimonial attributed to a named student would be a false claim about the
 * centre and about that person.
 *
 * To turn it off, set in the deployment environment:
 *
 *     NEXT_PUBLIC_SAMPLE_CONTENT=false
 *
 * Every gated section then renders its designed empty state instead, and the
 * page still works — nothing breaks, it simply shows nothing it cannot stand
 * behind.
 *
 * Not gated, because it is the centre's own copy rather than a claim about a
 * third party: news posts, gallery albums, course descriptions, branch details
 * and the legal drafts. Those are edited, not removed.
 */
export const SAMPLE_CONTENT = process.env.NEXT_PUBLIC_SAMPLE_CONTENT !== 'false'

/** Returns the sample list only while sample content is enabled. */
export function withSample<T>(items: T[]): T[] {
  return SAMPLE_CONTENT ? items : []
}
