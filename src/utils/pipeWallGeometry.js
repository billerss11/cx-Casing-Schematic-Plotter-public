import { PHYSICS_CONSTANTS } from '@/constants/index.js';
import { estimateCasingID, parseOptionalNumber } from '@/utils/general.js';

const EPSILON = 1e-6;

function resolveOuterDiameter(row = {}) {
  const od = parseOptionalNumber(row?.od);
  if (Number.isFinite(od) && od > 0) return od;

  const outerRadius = parseOptionalNumber(row?.outerRadius);
  if (Number.isFinite(outerRadius) && outerRadius > 0) {
    return outerRadius * 2;
  }

  return null;
}

function resolveInnerDiameter(row = {}, outerDiameter) {
  if (!Number.isFinite(outerDiameter) || outerDiameter <= 0) return null;

  const explicitInner = parseOptionalNumber(row?.innerDiameter);
  if (Number.isFinite(explicitInner) && explicitInner > 0 && explicitInner < outerDiameter) {
    return explicitInner;
  }

  const innerRadius = parseOptionalNumber(row?.innerRadius);
  if (Number.isFinite(innerRadius) && innerRadius > 0) {
    const diameter = innerRadius * 2;
    if (diameter > 0 && diameter < outerDiameter) return diameter;
  }

  const overrideInner = parseOptionalNumber(row?.idOverride);
  if (Number.isFinite(overrideInner) && overrideInner > 0) {
    return Math.min(overrideInner, outerDiameter * 0.98);
  }

  const weight = parseOptionalNumber(row?.weight) ?? 0;
  const estimatedInner = estimateCasingID(outerDiameter, weight);
  if (Number.isFinite(estimatedInner) && estimatedInner > 0) {
    return Math.min(estimatedInner, outerDiameter * 0.98);
  }

  return outerDiameter * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;
}

export function resolvePipeWallGeometry(row = {}, diameterScale = 1) {
  const od = resolveOuterDiameter(row);
  if (!Number.isFinite(od) || od <= 0) return null;

  const scale = Number.isFinite(Number(diameterScale)) && Number(diameterScale) > 0
    ? Number(diameterScale)
    : 1;
  const outerRadius = (od / 2) * scale;
  if (!Number.isFinite(outerRadius) || outerRadius <= EPSILON) return null;

  const innerDiameter = resolveInnerDiameter(row, od);
  if (!Number.isFinite(innerDiameter) || innerDiameter <= 0 || innerDiameter >= od) {
    return {
      outerRadius,
      innerRadius: outerRadius,
      wallThickness: 0,
      wallCenterRadius: outerRadius
    };
  }

  const innerRadius = Math.max(0, Math.min((innerDiameter / 2) * scale, outerRadius));
  const wallThickness = Math.max(0, outerRadius - innerRadius);
  return {
    outerRadius,
    innerRadius,
    wallThickness,
    wallCenterRadius: outerRadius - (wallThickness / 2)
  };
}

export default resolvePipeWallGeometry;
