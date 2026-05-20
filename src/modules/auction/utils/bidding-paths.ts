export const biddingListingPath = (listingId: string, subPath: string): string => {
    const cleanSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
    return `/api/v1/listings/${listingId}${cleanSubPath}`;
};
