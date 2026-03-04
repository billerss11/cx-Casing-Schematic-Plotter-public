function toFiniteNumber(value, fallback = null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeRange(min, max, fallbackMin = Number.NEGATIVE_INFINITY, fallbackMax = Number.POSITIVE_INFINITY) {
    const safeMin = toFiniteNumber(min, fallbackMin);
    const safeMax = toFiniteNumber(max, fallbackMax);
    return safeMin <= safeMax
        ? { min: safeMin, max: safeMax }
        : { min: safeMax, max: safeMin };
}

function resolveCameraScale(camera = {}) {
    const scale = toFiniteNumber(camera?.scale);
    if (Number.isFinite(scale) && scale > 0) return scale;

    const zoom = toFiniteNumber(camera?.zoom);
    if (Number.isFinite(zoom) && zoom > 0) return zoom;

    const k = toFiniteNumber(camera?.k);
    if (Number.isFinite(k) && k > 0) return k;

    return 1;
}

function resolveCameraTranslateX(camera = {}) {
    return toFiniteNumber(camera?.translateX, toFiniteNumber(camera?.x, toFiniteNumber(camera?.panX, 0)));
}

function resolveCameraTranslateY(camera = {}) {
    return toFiniteNumber(camera?.translateY, toFiniteNumber(camera?.y, toFiniteNumber(camera?.panY, 0)));
}

export function normalizeCameraState(camera = {}) {
    return {
        scale: resolveCameraScale(camera),
        translateX: resolveCameraTranslateX(camera),
        translateY: resolveCameraTranslateY(camera)
    };
}

export function buildCameraTransform(camera = {}) {
    const normalized = normalizeCameraState(camera);
    return `translate(${normalized.translateX} ${normalized.translateY}) scale(${normalized.scale})`;
}

export function applyCameraPoint(point, camera = {}) {
    const x = toFiniteNumber(point?.x);
    const y = toFiniteNumber(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const normalized = normalizeCameraState(camera);
    return {
        x: (x * normalized.scale) + normalized.translateX,
        y: (y * normalized.scale) + normalized.translateY
    };
}

export function invertCameraPoint(point, camera = {}) {
    const x = toFiniteNumber(point?.x);
    const y = toFiniteNumber(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const normalized = normalizeCameraState(camera);
    if (!Number.isFinite(normalized.scale) || normalized.scale <= 0) return null;
    return {
        x: (x - normalized.translateX) / normalized.scale,
        y: (y - normalized.translateY) / normalized.scale
    };
}

export function clampZoom(value, options = {}) {
    const { min, max } = normalizeRange(options?.min, options?.max, 0.1, 8);
    const fallback = clamp(toFiniteNumber(options?.fallback, 1), min, max);
    const zoom = toFiniteNumber(value, fallback);
    return clamp(zoom, min, max);
}

export function clampPan(value = {}, options = {}) {
    const source = (value && typeof value === 'object') ? value : {};
    const { min: minX, max: maxX } = normalizeRange(options?.minX, options?.maxX);
    const { min: minY, max: maxY } = normalizeRange(options?.minY, options?.maxY);

    const fallbackX = toFiniteNumber(options?.fallbackX, 0);
    const fallbackY = toFiniteNumber(options?.fallbackY, 0);

    const x = toFiniteNumber(source?.x, toFiniteNumber(source?.translateX, toFiniteNumber(source?.panX, fallbackX)));
    const y = toFiniteNumber(source?.y, toFiniteNumber(source?.translateY, toFiniteNumber(source?.panY, fallbackY)));

    return {
        x: clamp(x, minX, maxX),
        y: clamp(y, minY, maxY)
    };
}

export default {
    applyCameraPoint,
    buildCameraTransform,
    clampPan,
    clampZoom,
    invertCameraPoint,
    normalizeCameraState
};

