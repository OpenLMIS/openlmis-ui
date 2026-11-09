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
        <SettingsItem label={t('buq.forecast.region')}>{orEmpty(details.region)}</SettingsItem>
        <SettingsItem label={t('buq.forecast.council')}>{orEmpty(details.council)}</SettingsItem>
        <SettingsItem label={t('buq.forecast.facility-type')}>
          {orEmpty(details.facilityType)}
        </SettingsItem>
      </SettingsList>
      <SettingsList density="compact">
        <SettingsItem label={t('buq.forecast.facility-code')}>
          {orEmpty(details.facilityCode)}
        </SettingsItem>
        <SettingsItem label={t('buq.forecast.facility-name')}>
          <bdi>{orEmpty(details.facilityName)}</bdi>
        </SettingsItem>
        <SettingsItem label={t('buq.forecast.period')}>{orEmpty(details.period)}</SettingsItem>
      </SettingsList>
    </div>
  );
}
