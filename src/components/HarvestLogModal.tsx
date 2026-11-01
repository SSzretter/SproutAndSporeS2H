import React from 'react';
import { HarvestRecord } from '../types/sim';
import { PlayerInventoryModal } from './game/PlayerInventoryModal';

interface HarvestLogModalProps {
  harvests: HarvestRecord[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateHarvestRecord?: (updatedRecord: HarvestRecord) => void;
  onDeleteHarvestRecord?: (recordId: string) => void;
}

export const HarvestLogModal: React.FC<HarvestLogModalProps> = ({ 
  harvests, 
  isOpen, 
  onClose,
  onUpdateHarvestRecord,
  onDeleteHarvestRecord
}) => {
  return (
    <PlayerInventoryModal
      harvests={harvests}
      isOpen={isOpen}
      onClose={onClose}
      onUpdateHarvestRecord={onUpdateHarvestRecord}
      onDeleteHarvestRecord={onDeleteHarvestRecord}
    />
  );
};
