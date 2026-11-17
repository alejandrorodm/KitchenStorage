import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { FoodItem, FoodItemInput, Meal, MealInput, MealType, ReceiptLine, ShoppingEntry, Unit, User } from './types';

export const keys = {
  me: ['me'] as const,
  items: ['inventory', 'items'] as const,
  meals: (from: string, to: string) => ['meals', from, to] as const,
  shopping: ['shopping'] as const,
  receiptStatus: ['receipts', 'status'] as const,
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
    mutationFn: () => api<void>('POST', '/api/auth/logout'),
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
