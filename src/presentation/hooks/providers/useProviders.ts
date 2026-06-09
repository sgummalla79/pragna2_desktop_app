import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { RegisterProviderPayload } from '@/domain/types/provider.types';

const LLM_PROVIDERS_KEY                  = ['llm-providers']                   as const;
const LLM_PROVIDERS_WITH_REG_KEY         = ['llm-providers-with-registrations'] as const;
const PROVIDERS_KEY                      = ['providers']                        as const;
const MODELS_KEY                         = ['models']                           as const;

/** Fetches the global LLM provider catalogue (seeded at server startup, rarely changes). */
export function useLlmProviders() {
  const { llmProviderService } = useServices();
  return useQuery({
    queryKey: LLM_PROVIDERS_KEY,
    queryFn:  () => llmProviderService.listAll(),
    staleTime: Infinity,
  });
}

/**
 * Fetches all providers with the current user's registrations embedded.
 * Single network call — replaces useLlmProviders() + useProviders() on the providers page.
 * Empty userProviders array on an item means that provider is not connected.
 */
export function useLlmProvidersWithRegistrations() {
  const { llmProviderService } = useServices();
  return useQuery({
    queryKey: LLM_PROVIDERS_WITH_REG_KEY,
    queryFn:  () => llmProviderService.listWithRegistrations(),
    staleTime: 30_000,
  });
}

/** Fetches the user's connected providers. */
export function useProviders() {
  const { providerService } = useServices();
  return useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn:  () => providerService.list(),
    staleTime: 30_000,
  });
}

/**
 * Registers a provider and auto-discovers its models.
 * Invalidates the combined providers+registrations query and the models list.
 */
export function useRegisterProvider() {
  const { providerService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterProviderPayload) => providerService.register(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LLM_PROVIDERS_WITH_REG_KEY });
      queryClient.invalidateQueries({ queryKey: MODELS_KEY });
    },
  });
}

/**
 * Reconciles a provider's stored model list against the upstream provider.
 * Invalidates both the flat models list and the combined
 * providers-with-registrations query (ProvidersView modal pills) so the
 * UI reflects new/archived models everywhere they're surfaced.
 */
export function useRefreshModels() {
  const { providerService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => providerService.refreshModels(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODELS_KEY });
      queryClient.invalidateQueries({ queryKey: LLM_PROVIDERS_WITH_REG_KEY });
    },
  });
}

/**
 * Toggles a registered provider's enabled state via PATCH /api/user-providers/{id}.
 * On success re-fetches the combined providers-with-registrations query so every
 * tile reflects the new state immediately.
 */
export function useToggleProvider() {
  const { providerService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      providerService.toggle(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LLM_PROVIDERS_WITH_REG_KEY }),
  });
}

/** Deletes a provider and cascades to all its models. */
export function useDeleteProvider() {
  const { providerService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => providerService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LLM_PROVIDERS_WITH_REG_KEY });
      queryClient.invalidateQueries({ queryKey: MODELS_KEY });
    },
  });
}
