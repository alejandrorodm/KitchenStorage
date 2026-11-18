import { createContext, useContext } from 'react';

export type Section = 'today' | 'inventory' | 'planner' | 'dishes' | 'shopping' | 'receipt' | 'household' | 'admin';

export const SECTIONS: Section[] = ['today', 'inventory', 'planner', 'dishes', 'shopping', 'receipt', 'household', 'admin'];

export const NavigationContext = createContext<(section: Section) => void>(() => {});

export function useNavigate() {
  return useContext(NavigationContext);
}
