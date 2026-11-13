import { useTranslation } from 'react-i18next';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { orEmpty } from '@/lib/empty-value';

export type ForecastDetails = {
  region: string;
  council: string;
  facilityType: string;
  facilityCode: string;
  facilityName: string;
  period: string;
};

export function ForecastDetailsList({ details }: { details: ForecastDetails }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2">
      <SettingsList density="compact">
        <SettingsItem label={t('buq.forecast.region')}>
          <bdi>{orEmpty(details.region)}</bdi>
        </SettingsItem>
        <SettingsItem label={t('buq.forecast.council')}>
          <bdi>{orEmpty(details.council)}</bdi>
        </SettingsItem>
        <SettingsItem label={t('buq.forecast.facility-type')}>
          <bdi>{orEmpty(details.facilityType)}</bdi>
        </SettingsItem>
      </SettingsList>
      <SettingsList density="compact">
        <SettingsItem label={t('buq.forecast.facility-code')}>
          <bdi>{orEmpty(details.facilityCode)}</bdi>
        </SettingsItem>
        <SettingsItem label={t('buq.forecast.facility-name')}>
          <bdi>{orEmpty(details.facilityName)}</bdi>
        </SettingsItem>
        <SettingsItem label={t('buq.forecast.period')}>
          <bdi>{orEmpty(details.period)}</bdi>
        </SettingsItem>
      </SettingsList>
    </div>
  );
}
