import { unref } from 'vue';
import { resolveSvgPointerPosition } from '@/composables/useSchematicInteraction.js';
import { invertCameraPoint, normalizeCameraState } from '@/utils/svgTransformMath.js';

function toFiniteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function resolveScreenPoint(event) {
  const x = toFiniteNumber(event?.clientX);
  const y = toFiniteNumber(event?.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function resolveSvgElement(source) {
  const resolved = typeof source === 'function' ? source() : source;
  return unref(resolved);
}

export function createSchematicPointerMapping(options = {}) {
  function reportFailure(reason) {
    if (typeof options.onFailure !== 'function') return;
    options.onFailure(reason);
  }

  function resolvePointer(event) {
    const screenPoint = resolveScreenPoint(event);
    if (!screenPoint) {
      reportFailure('invalid-screen-point');
      return null;
    }

    const svgElement = resolveSvgElement(options.svgElement);
    const svgPoint = resolveSvgPointerPosition(svgElement, event);
    if (!svgPoint) {
      reportFailure('svg-pointer-unresolved');
      return null;
    }

    const rawCamera = typeof options.resolveCamera === 'function'
      ? options.resolveCamera()
      : options.camera;
    const camera = normalizeCameraState(rawCamera);
    const canonicalPoint = invertCameraPoint(svgPoint, camera);
    if (!canonicalPoint) {
      reportFailure('canonical-pointer-unresolved');
      return null;
    }

    return {
      screenPoint,
      svgPoint,
      canonicalPoint,
      camera
    };
  }

  return {
    resolvePointer
  };
}

export default createSchematicPointerMapping;

