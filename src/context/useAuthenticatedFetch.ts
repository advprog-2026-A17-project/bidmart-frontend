import { useAuth } from './useAuth';

export const useAuthenticatedFetch = () => useAuth().authenticatedFetch;
