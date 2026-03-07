import { NODE_KIND_BORE, TOPOLOGY_VOLUME_KINDS } from '@/topology/topologyTypes.js';

export function buildSealByVolumeDefaults({ bore = false, annulus = false } = {}) {
    const defaults = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        defaults[volumeKey] = volumeKey === NODE_KIND_BORE
            ? Boolean(bore)
            : Boolean(annulus);
    });
    return defaults;
}

export function normalizeToken(value) {
    return String(value ?? '').trim().toLowerCase();
}

export function normalizeStringOrNull(value) {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
}

export function toPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return { ...value };
}
