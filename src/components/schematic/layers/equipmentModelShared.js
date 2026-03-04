import {
  normalizeEquipmentTypeKey,
  resolveEquipmentTypeLabel
} from '@/topology/equipmentDefinitions/index.js';

const PACKER_LIKE_TYPE_KEYS = Object.freeze(new Set(['packer', 'bridge-plug']));
const SAFETY_VALVE_TYPE_KEY = 'safety-valve';

export function isPackerLikeEquipmentType(typeValue) {
  const typeKey = normalizeEquipmentTypeKey(typeValue);
  return PACKER_LIKE_TYPE_KEYS.has(typeKey);
}

export function isSafetyValveEquipmentType(typeValue) {
  return normalizeEquipmentTypeKey(typeValue) === SAFETY_VALVE_TYPE_KEY;
}

export function resolveEquipmentTypeSemantics(typeValue) {
  const typeKey = normalizeEquipmentTypeKey(typeValue);
  return {
    typeKey,
    label: resolveEquipmentTypeLabel(typeValue),
    isPackerLike: PACKER_LIKE_TYPE_KEYS.has(typeKey),
    isSafetyValve: typeKey === SAFETY_VALVE_TYPE_KEY
  };
}

export default {
  isPackerLikeEquipmentType,
  isSafetyValveEquipmentType,
  resolveEquipmentTypeSemantics
};
