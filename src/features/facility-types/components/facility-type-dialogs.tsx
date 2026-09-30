import { FacilityTypeFormDialog } from '@/features/facility-types/components/facility-type-form-dialog';

type FacilityTypeDialogsProps = {
  facilityType: 'new' | string | undefined;
  onClose: () => void;
};

export function FacilityTypeDialogs({ facilityType, onClose }: FacilityTypeDialogsProps) {
  return <FacilityTypeFormDialog onClose={onClose} target={facilityType} />;
}
