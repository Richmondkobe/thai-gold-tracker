// Config for the statically generated /ราคาทองปี/[year] pages, one per
// Buddhist year the site has data for. Same URL pattern as the other
// generated pages: ASCII route folder (app/gold-price-year/[year]) with the
// Thai public path rewritten onto it in next.config.ts; use encodeURI() when
// emitting the path in URLs.
//
// Data starts 2016-01-02 (พ.ศ. 2559) and runs through the current year
// (พ.ศ. 2569 as of writing) - 11 years, not 10. Both endpoints get their own
// special-cased wording (2559's partial first year, 2569 being still in
// progress), so both need pages regardless of the exact count.

export const FIRST_YEAR_BE = 2559;
export const CURRENT_YEAR_BE = 2569;

export interface YearPageConfig {
  buddhistYear: number;
  gregorianYear: number;
}

export const YEAR_PAGES: YearPageConfig[] = Array.from(
  { length: CURRENT_YEAR_BE - FIRST_YEAR_BE + 1 },
  (_, i) => {
    const buddhistYear = FIRST_YEAR_BE + i;
    return { buddhistYear, gregorianYear: buddhistYear - 543 };
  },
);

export function getYearPageConfig(yearParam: string): YearPageConfig | null {
  const n = Number(yearParam);
  return YEAR_PAGES.find((p) => p.buddhistYear === n) ?? null;
}

/** Decoded app path, e.g. "/ราคาทองปี/2569". Wrap in encodeURI() for URLs. */
export function yearPagePath(buddhistYear: number): string {
  return `/ราคาทองปี/${buddhistYear}`;
}
