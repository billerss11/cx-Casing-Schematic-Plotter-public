function toSafeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return null;
}

export function resolveTopologyOverlayHintKey(synchronizationState = {}) {
  const reason = String(synchronizationState?.reason ?? '').trim();
  if (reason === 'stale_result') return 'ui.analysis.topology.overlay_sync.stale_result';
  if (reason === 'expected_request_pending') return 'ui.analysis.topology.overlay_sync.geometry_pending';
  if (reason === 'request_mismatch') return 'ui.analysis.topology.overlay_sync.request_mismatch';
  return 'ui.analysis.topology.overlay_sync.updating';
}

export function formatTopologyOverlayHintDetail(synchronizationState = {}) {
  const latestRequestId = toSafeInteger(synchronizationState?.latestRequestId);
  const resultRequestId = toSafeInteger(synchronizationState?.resultRequestId);
  const expectedRequestId = toSafeInteger(synchronizationState?.expectedRequestId);
  const reason = String(synchronizationState?.reason ?? '').trim();

  if (resultRequestId === null || latestRequestId === null) return '';
  if (expectedRequestId !== null) {
    return `overlay_request=${resultRequestId} | geometry_request=${expectedRequestId} | latest_request=${latestRequestId}`;
  }
  if (reason === 'expected_request_pending') {
    return `overlay_request=${resultRequestId} | geometry_request=pending | latest_request=${latestRequestId}`;
  }
  return `overlay_request=${resultRequestId} | latest_request=${latestRequestId}`;
}

export default {
  resolveTopologyOverlayHintKey,
  formatTopologyOverlayHintDetail
};
