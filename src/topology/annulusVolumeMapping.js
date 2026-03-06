import {
    resolveAnnulusLayerByIndex,
    resolveAnnulusSlotIndex
} from '@/utils/physicsLayers.js';
import {
    MAX_MODELED_ANNULUS_SLOT_INDEX,
    MODELED_ANNULUS_VOLUME_SLOTS
} from '@/topology/topologyTypes.js';

function resolveModeledAnnulusSlotByKind(kind) {
    return MODELED_ANNULUS_VOLUME_SLOTS.find((slot) => slot.kind === kind) ?? null;
}

function resolveModeledAnnulusSlotByIndex(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;
    return MODELED_ANNULUS_VOLUME_SLOTS.find((slot) => slot.slotIndex === slotIndex) ?? null;
}

export function hasTubingAnnulusLayer(stack = []) {
    const slotZeroLayer = resolveAnnulusLayerByIndex(stack, 0);
    if (!slotZeroLayer || slotZeroLayer?.role !== 'annulus') return false;
    return String(slotZeroLayer?.innerPipe?.pipeType ?? '').trim().toLowerCase() === 'tubing';
}

export function resolvePhysicalSlotIndexForCasingAnnulusKind(kind) {
    const modeledSlot = resolveModeledAnnulusSlotByKind(kind);
    if (!modeledSlot) return null;
    return modeledSlot.slotIndex;
}

export function resolveAnnulusLayerForVolumeKind(stack = [], volumeKind = '') {
    const physicalSlotIndex = resolvePhysicalSlotIndexForCasingAnnulusKind(volumeKind);
    if (!Number.isInteger(physicalSlotIndex)) return null;
    return resolveAnnulusLayerByIndex(stack, physicalSlotIndex);
}

export function resolveVolumeKindForAnnulusLayer(stack = [], annulusLayer = null) {
    if (!annulusLayer || annulusLayer?.role !== 'annulus') return null;

    const slotIndex = resolveAnnulusSlotIndex(annulusLayer);
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;

    const casingSlot = resolveModeledAnnulusSlotByIndex(slotIndex);
    return casingSlot?.kind ?? null;
}

export function resolveMaxModeledAnnulusSlotIndexForStack(stack = []) {
    return MAX_MODELED_ANNULUS_SLOT_INDEX;
}

export default {
    hasTubingAnnulusLayer,
    resolvePhysicalSlotIndexForCasingAnnulusKind,
    resolveAnnulusLayerForVolumeKind,
    resolveVolumeKindForAnnulusLayer,
    resolveMaxModeledAnnulusSlotIndexForStack
};
