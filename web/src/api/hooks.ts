import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disablePush } from '../shared/push';
import { api } from './client';
import type { Category, Dish, DishInput, DishSuggestion, FoodItem, FoodItemInput, Household, HouseholdSummary, Invite, Meal, MealInput, MealType, ReceiptLine, ShoppingEntry, Unit, User } from './types';

export const keys = {
  me: ['me'] as const,
  items: ['inventory', 'items'] as const,
  categories: ['inventory', 'categories'] as const,
  meals: (from: string, to: string) => ['meals', from, to] as const,
  shopping: ['shopping'] as const,
  receiptStatus: ['receipts', 'status'] as const,
  aiStatus: ['ai', 'status'] as const,
  dishes: ['dishes'] as const,
  household: ['household'] as const,
  push: ['push'] as const,
  invites: ['admin', 'invites'] as const,
  households: ['admin', 'households'] as const,
};

/** Data that changes together: stock edits affect alerts, the planner and the shopping list. */
const STOCK_TOPICS = [['inventory'], ['meals'], ['shopping']];

function useInvalidate() {
  const client = useQueryClient();
  return (queryKeys: readonly (readonly string[])[] = STOCK_TOPICS) =>
    Promise.all(queryKeys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

// Auth

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<User>('GET', '/api/auth/me'), retry: false, staleTime: Infinity });
}

export function useLogin(mode: 'login' | 'register') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string; inviteCode?: string }) =>
      api<User>('POST', `/api/auth/${mode}`, body),
    onSuccess: (user) => client.setQueryData(keys.me, user),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    // This device stops receiving the household's notifications once nobody is signed in.
    mutationFn: async () => {
      await disablePush().catch(() => undefined);
      await api<void>('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] });
      client.setQueryData(keys.me, null);
    },
  });
}

// Inventory

export function useItems() {
  return useQuery({ queryKey: keys.items, queryFn: () => api<FoodItem[]>('GET', '/api/items') });
}

export function useSaveItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FoodItemInput }) =>
      id ? api<FoodItem>('PATCH', `/api/items/${id}`, input) : api<FoodItem>('POST', '/api/items', input),
    onSuccess: () => invalidate(),
  });
}

export function useAdjustItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => api<FoodItem>('POST', `/api/items/${id}/adjust`, { delta }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/api/items/${id}`),
    onSuccess: () => invalidate(),
  });
}

// Categories (under the inventory topic, so live events refresh them too)

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api<Category[]>('GET', '/api/categories') });
}

export function useCategoryAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (action: { type: 'create'; name: string } | { type: 'rename'; id: string; name: string } | { type: 'delete'; id: string }) => {
      if (action.type === 'create') return api<Category | void>('POST', '/api/categories', { name: action.name });
      if (action.type === 'rename') return api<Category | void>('PATCH', `/api/categories/${action.id}`, { name: action.name });
      return api<Category | void>('DELETE', `/api/categories/${action.id}`);
    },
    onSuccess: () => invalidate([['inventory']]),
  });
}

// Meal planner

export function useMeals(from: string, to: string) {
  return useQuery({ queryKey: keys.meals(from, to), queryFn: () => api<Meal[]>('GET', `/api/meals?from=${from}&to=${to}`) });
}

export function useSaveMeal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ date, mealType, input }: { date: string; mealType: MealType; input: MealInput }) =>
      api<Meal>('PUT', `/api/meals/${date}/${mealType}`, input),
    onSuccess: () => invalidate(),
  });
}

export function useMealAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'consume' | 'unconsume' | 'delete' }) =>
      action === 'delete' ? api<Meal | void>('DELETE', `/api/meals/${id}`) : api<Meal | void>('POST', `/api/meals/${id}/${action}`),
    onSuccess: () => invalidate(),
  });
}

// Shopping list

export function useShopping() {
  return useQuery({ queryKey: keys.shopping, queryFn: () => api<ShoppingEntry[]>('GET', '/api/shopping') });
}

export function useAddShopping() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { name: string; quantity?: number | null; unit?: Unit | null }) =>
      api<ShoppingEntry>('POST', '/api/shopping', body),
    onSuccess: () => invalidate([keys.shopping]),
  });
}

export function useShoppingAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (action: { type: 'check'; id: string; checked: boolean } | { type: 'delete'; id: string } | { type: 'clear' }) => {
      if (action.type === 'check') return api('PATCH', `/api/shopping/${action.id}`, { checked: action.checked });
      if (action.type === 'delete') return api('DELETE', `/api/shopping/${action.id}`);
      return api('POST', '/api/shopping/clear-checked');
    },
    onSuccess: () => invalidate([keys.shopping]),
  });
}

// Receipts

export function useReceiptStatus() {
  return useQuery({
    queryKey: keys.receiptStatus,
    queryFn: () => api<{ enabled: boolean }>('GET', '/api/receipts/status'),
    staleTime: Infinity,
  });
}

export function useReadReceipt() {
  return useMutation({
    mutationFn: (image: File) => {
      const form = new FormData();
      form.append('image', image);
      return api<{ lines: ReceiptLine[] }>('POST', '/api/receipts/read', form);
    },
  });
}

export function useConfirmReceipt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (lines: ReceiptLine[]) => api<{ merged: boolean }[]>('POST', '/api/receipts/confirm', { lines }),
    onSuccess: () => invalidate(),
  });
}

// AI helpers

export function useAiStatus() {
  return useQuery({ queryKey: keys.aiStatus, queryFn: () => api<{ enabled: boolean }>('GET', '/api/ai/status'), staleTime: Infinity });
}

/** Lets the AI place the items that have no category yet. */
export function useCategorize() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api<{ categorized: number; remaining: number }>('POST', '/api/items/categorize'),
    onSuccess: () => invalidate([['inventory']]),
  });
}

export function useDishes() {
  return useQuery({ queryKey: keys.dishes, queryFn: () => api<Dish[]>('GET', '/api/dishes') });
}

export type DishAction = { type: 'create'; input: DishInput } | { type: 'update'; id: string; input: DishInput } | { type: 'delete'; id: string };

export function useDishAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (action: DishAction) => {
      if (action.type === 'create') return api<Dish | void>('POST', '/api/dishes', action.input);
      if (action.type === 'update') return api<Dish | void>('PATCH', `/api/dishes/${action.id}`, action.input);
      return api<Dish | void>('DELETE', `/api/dishes/${action.id}`);
    },
    onSuccess: () => invalidate([keys.dishes]),
  });
}

export function useSuggestDishes() {
  return useMutation({
    mutationFn: (wish: string) => api<{ dishes: DishSuggestion[] }>('POST', '/api/dishes/suggest', { wish }),
  });
}

// Household

export function useHousehold() {
  return useQuery({ queryKey: keys.household, queryFn: () => api<Household>('GET', '/api/household') });
}

/** Changing the alert threshold re-evaluates stock alerts and the shopping list. */
export function useUpdateHousehold() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (settings: { lowThreshold: number }) => api<Household>('PATCH', '/api/household', settings),
    onSuccess: (household) => {
      client.setQueryData(keys.household, household);
      return invalidate();
    },
  });
}

export function usePushKey() {
  return useQuery({ queryKey: keys.push, queryFn: () => api<{ publicKey: string | null }>('GET', '/api/push'), staleTime: Infinity });
}

export function useRegenerateHouseholdCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<Household>('POST', '/api/household/invite-code'),
    onSuccess: (household) => client.setQueryData(keys.household, household),
  });
}

// Admin

export function useInvites() {
  return useQuery({ queryKey: keys.invites, queryFn: () => api<Invite[]>('GET', '/api/admin/invites') });
}

export function useHouseholds() {
  return useQuery({ queryKey: keys.households, queryFn: () => api<HouseholdSummary[]>('GET', '/api/admin/households') });
}

export function useInviteAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (action: { type: 'create' } | { type: 'revoke'; code: string }) =>
      action.type === 'create'
        ? api<Invite | void>('POST', '/api/admin/invites')
        : api<Invite | void>('DELETE', `/api/admin/invites/${action.code}`),
    onSuccess: () => invalidate([['admin']]),
  });
}
