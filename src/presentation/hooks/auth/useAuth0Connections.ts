import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';

export function useAuth0Connections() {
  const { authService } = useServices();
  return useQuery({
    queryKey: ['auth0-connections'],
    queryFn: () => authService.fetchSocialConnections(),
    staleTime: Infinity,
    retry: false,
  });
}
