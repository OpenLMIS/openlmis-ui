import { useAppForm } from '@/components/form/form';
import type { ForecastDraft } from '@/features/buq/lib/forecast';

export const useForecastForm = (defaultValues: ForecastDraft) => useAppForm({ defaultValues });

export type ForecastFormApi = ReturnType<typeof useForecastForm>;
