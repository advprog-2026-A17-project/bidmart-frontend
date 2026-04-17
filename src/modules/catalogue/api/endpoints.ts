export const CATALOGUE_LISTINGS_BASE_PATH = '/api/v1/catalogue/listings';
export const CATALOGUE_LISTINGS_SEARCH_PATH = `${CATALOGUE_LISTINGS_BASE_PATH}/search`;

export const catalogueListingSummaryPath = (listingId: string): string =>
    `${CATALOGUE_LISTINGS_BASE_PATH}/${listingId}/summary`;
