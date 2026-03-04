import { normalizeRowId } from '@/utils/rowIdentity.js';
import { resolveDomainEntryByEntityType } from '@/workspace/domainRegistry.js';

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeSelectableEntityType(value) {
  const domainEntry = resolveDomainEntryByEntityType(value);
  return domainEntry?.canonicalEntityType ?? null;
}

export function getSelectionRowLocatorMeta(entityType) {
  const domainEntry = resolveDomainEntryByEntityType(entityType);
  if (!domainEntry?.storeKey) return null;
  return {
    storeKey: domainEntry.storeKey,
    interactionType: domainEntry.interactionType ?? null,
    canHighlight: domainEntry.canHighlight === true,
    filterRows: typeof domainEntry.selectionFilterRows === 'function'
      ? domainEntry.selectionFilterRows
      : null
  };
}

export function resolveSelectionRowTarget(projectDataStore, rowRef = {}) {
  const normalizedEntityType = normalizeSelectableEntityType(rowRef?.entityType);
  const normalizedRowId = normalizeRowId(rowRef?.rowId);
  if (!projectDataStore || !normalizedEntityType || !normalizedRowId) return null;

  const meta = getSelectionRowLocatorMeta(normalizedEntityType);
  if (!meta) return null;

  const rawRows = toSafeArray(projectDataStore[meta.storeKey]);
  const domainRows = typeof meta.filterRows === 'function'
    ? meta.filterRows(rawRows)
    : rawRows;
  const domainRowIndex = domainRows.findIndex((row) => normalizeRowId(row?.rowId) === normalizedRowId);
  if (domainRowIndex < 0) return null;

  const row = domainRows[domainRowIndex];
  const storeRowIndex = rawRows.findIndex((rawRow) => normalizeRowId(rawRow?.rowId) === normalizedRowId);

  return {
    row,
    rowId: normalizedRowId,
    entityType: normalizedEntityType,
    storeKey: meta.storeKey,
    interactionType: meta.interactionType,
    canHighlight: meta.canHighlight === true,
    domainRowIndex,
    storeRowIndex: storeRowIndex >= 0 ? storeRowIndex : domainRowIndex
  };
}
