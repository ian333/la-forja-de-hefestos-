import { createContext, useContext } from 'react';
import type { Audience } from './types';

export const AudienceContext = createContext<{
  audience: Audience;
  setAudience: (a: Audience) => void;
}>({
  audience: 'researcher',
  setAudience: () => {},
});

export function useAudience() {
  return useContext(AudienceContext);
}
