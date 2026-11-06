import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PLANNING, settingsFromRow, settingsToRow, type PlanningSettings } from '@/lib/planning';

const key = (userId: string | undefined) => ['planning-settings', userId] as const;

/**
 * Capacidade por dia da semana do usuário. Sem linha no banco (ou antes da
 * migration 000600), vale o padrão: 6h de segunda a sexta.
 */
export function usePlanningSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: key(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ settings: PlanningSettings; saved: boolean }> => {
      const { data, error } = await supabase
        .from('user_planning_settings')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) {
        console.warn('Configuração de capacidade indisponível; usando o padrão.', error);
        return { settings: { ...DEFAULT_PLANNING }, saved: false };
      }
      return { settings: settingsFromRow(data), saved: !!data };
    },
  });

  const mutation = useMutation({
    mutationFn: async (settings: PlanningSettings) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('user_planning_settings')
        .upsert({ user_id: userId, ...settingsToRow(settings) }, { onConflict: 'user_id' });
      if (error) throw error;
      return settings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(key(userId), { settings, saved: true });
    },
  });

  return {
    settings: query.data?.settings ?? DEFAULT_PLANNING,
    saved: query.data?.saved ?? false,
    loading: query.isLoading,
    save: mutation.mutateAsync,
    saving: mutation.isPending,
  };
}
