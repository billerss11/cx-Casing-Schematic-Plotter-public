<script setup>
defineOptions({ name: 'LasWorkspace' });

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import * as d3 from 'd3';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Select from 'primevue/select';
import { useLasStore } from '@/stores/lasStore.js';

const lasStore = useLasStore();
const plotContainerRef = ref(null);
const correlationContainerRef = ref(null);
const selectedCurveNames = ref([]);
const selectedWellSectionName = ref(null);
const plotError = ref(null);

const activeSession = computed(() => lasStore.activeSession);
const curveData = computed(() => lasStore.activeCurveData);
const curveStatistics = computed(() => lasStore.activeCurveStatistics);
const correlationMatrix = computed(() => lasStore.activeCorrelationMatrix);

const curveOptions = computed(() => {
  const session = activeSession.value;
  if (!session?.curves) return [];
  const validCurveSet = new Set(Array.isArray(session.validCurves) ? session.validCurves : []);
  return session.curves
    .filter((curve) => curve.mnemonic !== session.indexCurve)
    .filter((curve) => validCurveSet.size === 0 || validCurveSet.has(curve.mnemonic))
    .map((curve) => ({
      mnemonic: curve.mnemonic,
      unit: curve.unit || '',
      description: curve.description || '',
      label: curve.unit ? `${curve.mnemonic} (${curve.unit})` : curve.mnemonic,
    }));
});

const sessionOptions = computed(() =>
  lasStore.sessionList.map((session) => ({
    value: session.sessionId,
    label: `${session.wellName || session.fileName} - ${session.curveCount} curves, ${session.rowCount} rows`,
  }))
);

const activeSessionId = computed({
  get: () => lasStore.activeSessionId,
  set: (id) => lasStore.setActiveSession(id),
});

const hasData = computed(() => curveData.value?.series?.length > 0);
const isLoading = computed(() => lasStore.loading);
const storeError = computed(() => lasStore.error);
const storeErrorCode = computed(() => lasStore.errorCode);
const storeErrorDetails = computed(() => {
  const details = lasStore.errorDetails;
  if (details === null || details === undefined) return null;
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
});

const backendErrorContext = computed(() => {
  if (!storeError.value) return '';
  const meta = lasStore.lastRequestMeta ?? {};
  const parts = [];
  if (storeErrorCode.value) parts.push(`code=${storeErrorCode.value}`);
  if (meta.task) parts.push(`task=${meta.task}`);
  if (meta.requestId) parts.push(`request=${meta.requestId}`);
  const elapsedMs = Number(meta.elapsedMs);
  if (Number.isFinite(elapsedMs)) parts.push(`elapsed=${elapsedMs}ms`);
  return parts.join(' | ');
});

const overview = computed(() => activeSession.value?.overview ?? null);
const curveRanges = computed(() => activeSession.value?.curveRanges ?? []);
const dataPreview = computed(() => activeSession.value?.dataPreview ?? null);

const wellSectionMap = computed(() => activeSession.value?.wellInformation?.sections ?? {});
const wellSectionOptions = computed(() =>
  Object.keys(wellSectionMap.value).map((name) => ({ value: name, label: name }))
);
const wellSectionRows = computed(() => {
  const section = selectedWellSectionName.value;
  if (!section) return [];
  const rows = wellSectionMap.value?.[section];
  return Array.isArray(rows) ? rows : [];
});

const statisticsRows = computed(() => curveStatistics.value?.metrics ?? []);
const statisticsColumns = computed(() => curveStatistics.value?.columns ?? []);

const previewColumns = computed(() => {
  const headRows = dataPreview.value?.head;
  if (!Array.isArray(headRows) || headRows.length === 0) return [];
  return Object.keys(headRows[0]);
});

watch(
  activeSession,
  (session) => {
    const persisted = Array.isArray(session?.selectedCurves) ? session.selectedCurves : [];
    selectedCurveNames.value = [...persisted];
  },
  { immediate: true }
);

watch(
  wellSectionOptions,
  (options) => {
    if (!Array.isArray(options) || options.length === 0) {
      selectedWellSectionName.value = null;
      return;
    }
    const current = selectedWellSectionName.value;
    if (options.some((option) => option.value === current)) return;
    selectedWellSectionName.value = options[0].value;
  },
  { immediate: true }
);

watch(
  curveData,
  async (data) => {
    await nextTick();
    if (!data?.series?.length) {
      clearPlot();
      return;
    }
    renderPlot(data);
  },
  { immediate: true }
);

watch(
  correlationMatrix,
  async (matrixData) => {
    await nextTick();
    if (!matrixData?.curves?.length || !matrixData?.matrix?.length) {
      clearCorrelationHeatmap();
      return;
    }
    renderCorrelationHeatmap(matrixData);
  },
  { immediate: true }
);

async function handleOpenFile() {
  plotError.value = null;
  try {
    await lasStore.openAndParseFile();
    if (activeSession.value) {
      selectedCurveNames.value = [];
    }
  } catch (err) {
    plotError.value = err.message;
  }
}

async function handleFetchCurves() {
  if (!selectedCurveNames.value.length) return;
  plotError.value = null;
  try {
    await lasStore.fetchCurveData(selectedCurveNames.value);
  } catch (err) {
    plotError.value = err.message;
  }
}

async function handleFetchStatistics() {
  if (!selectedCurveNames.value.length) return;
  plotError.value = null;
  try {
    await lasStore.fetchCurveStatistics(selectedCurveNames.value);
  } catch (err) {
    plotError.value = err.message;
  }
}

async function handleFetchCorrelation() {
  if (selectedCurveNames.value.length < 2) return;
  plotError.value = null;
  try {
    await lasStore.fetchCorrelationMatrix(selectedCurveNames.value);
  } catch (err) {
    plotError.value = err.message;
  }
}

async function handleCloseSession() {
  await lasStore.deleteSession();
  selectedCurveNames.value = [];
  clearPlot();
  clearCorrelationHeatmap();
}

function selectAllCurves() {
  selectedCurveNames.value = curveOptions.value.map((curve) => curve.mnemonic);
}

function clearSelection() {
  selectedCurveNames.value = [];
}

function clearPlot() {
  const container = plotContainerRef.value;
  if (!container) return;
  container.innerHTML = '';
}

function clearCorrelationHeatmap() {
  const container = correlationContainerRef.value;
  if (!container) return;
  container.innerHTML = '';
}

function renderPlot(data) {
  const container = plotContainerRef.value;
  if (!container) return;
  container.innerHTML = '';

  const series = data.series;
  const indexCurve = data.indexCurve;
  const trackCount = series.length;
  if (trackCount === 0) return;

  const trackWidth = 200;
  const headerHeight = 50;
  const margin = { top: 10, right: 20, bottom: 40, left: 60 };
  const totalWidth = margin.left + trackCount * trackWidth + margin.right;
  const totalHeight = 600;
  const plotHeight = totalHeight - margin.top - margin.bottom - headerHeight;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', totalWidth)
    .attr('height', totalHeight)
    .style('background', 'var(--color-surface-elevated, #fff)')
    .style('border', '1px solid var(--line, #ccc)')
    .style('border-radius', '8px');

  const depthRange = data.depthRange || {};
  const yScale = d3
    .scaleLinear()
    .domain([depthRange.minDepth, depthRange.maxDepth])
    .range([margin.top + headerHeight, margin.top + headerHeight + plotHeight]);

  const yAxis = d3.axisLeft(yScale).ticks(12);
  svg
    .append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis)
    .selectAll('text')
    .style('font-size', '11px')
    .style('fill', 'var(--p-text-color, #333)');

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(margin.top + headerHeight + plotHeight / 2))
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '600')
    .style('fill', 'var(--p-text-color, #333)')
    .text(`${indexCurve}${depthRange.depthUnit ? ` (${depthRange.depthUnit})` : ''}`);

  const colors = d3.schemeTableau10;
  series.forEach((entry, index) => {
    const trackX = margin.left + index * trackWidth;

    svg
      .append('line')
      .attr('x1', trackX)
      .attr('x2', trackX)
      .attr('y1', margin.top + headerHeight)
      .attr('y2', margin.top + headerHeight + plotHeight)
      .attr('stroke', 'var(--line, #ddd)')
      .attr('stroke-width', 1);

    const headerLabel = entry.unit ? `${entry.mnemonic} (${entry.unit})` : entry.mnemonic;
    svg
      .append('text')
      .attr('x', trackX + trackWidth / 2)
      .attr('y', margin.top + headerHeight - 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('fill', colors[index % colors.length])
      .text(headerLabel);

    if (!entry.points?.length) return;
    const values = entry.points.filter((point) => point[1] !== null).map((point) => point[1]);
    if (!values.length) return;

    const xScale = d3
      .scaleLinear()
      .domain([d3.min(values), d3.max(values)])
      .range([trackX + 8, trackX + trackWidth - 8]);

    const line = d3
      .line()
      .defined((point) => point[1] !== null)
      .x((point) => xScale(point[1]))
      .y((point) => yScale(point[0]));

    svg
      .append('path')
      .datum(entry.points)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', colors[index % colors.length])
      .attr('stroke-width', 1.5);

    const xAxisBottom = d3.axisBottom(xScale).ticks(4).tickFormat(d3.format('.2s'));
    svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top + headerHeight + plotHeight})`)
      .call(xAxisBottom)
      .selectAll('text')
      .style('font-size', '9px')
      .style('fill', 'var(--p-text-muted-color, #888)');
  });

  svg
    .append('line')
    .attr('x1', margin.left + trackCount * trackWidth)
    .attr('x2', margin.left + trackCount * trackWidth)
    .attr('y1', margin.top + headerHeight)
    .attr('y2', margin.top + headerHeight + plotHeight)
    .attr('stroke', 'var(--line, #ddd)')
    .attr('stroke-width', 1);
}

function renderCorrelationHeatmap(data) {
  const container = correlationContainerRef.value;
  if (!container) return;
  container.innerHTML = '';

  const curves = Array.isArray(data.curves) ? data.curves : [];
  const matrix = Array.isArray(data.matrix) ? data.matrix : [];
  if (!curves.length || !matrix.length) return;

  const cellSize = 36;
  const innerSize = curves.length * cellSize;
  const margin = { top: 88, right: 16, bottom: 16, left: 88 };
  const width = margin.left + innerSize + margin.right;
  const height = margin.top + innerSize + margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'var(--color-surface-elevated, #fff)')
    .style('border', '1px solid var(--line, #ccc)')
    .style('border-radius', '8px');

  const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
  const xScale = d3.scaleBand().domain(curves).range([0, innerSize]).padding(0.04);
  const yScale = d3.scaleBand().domain(curves).range([0, innerSize]).padding(0.04);
  const color = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);

  const cells = [];
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      cells.push({
        rowCurve: curves[rowIndex],
        colCurve: curves[colIndex],
        value: Number.isFinite(Number(value)) ? Number(value) : null,
      });
    });
  });

  root
    .selectAll('rect')
    .data(cells)
    .enter()
    .append('rect')
    .attr('x', (entry) => xScale(entry.colCurve))
    .attr('y', (entry) => yScale(entry.rowCurve))
    .attr('width', xScale.bandwidth())
    .attr('height', yScale.bandwidth())
    .attr('fill', (entry) => (entry.value === null ? '#f2f2f2' : color(entry.value)))
    .attr('stroke', 'rgba(0, 0, 0, 0.08)')
    .append('title')
    .text((entry) => `${entry.rowCurve} vs ${entry.colCurve}: ${entry.value === null ? 'N/A' : entry.value.toFixed(3)}`);

  root
    .selectAll('.corr-text')
    .data(cells)
    .enter()
    .append('text')
    .attr('class', 'corr-text')
    .attr('x', (entry) => xScale(entry.colCurve) + xScale.bandwidth() / 2)
    .attr('y', (entry) => yScale(entry.rowCurve) + yScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#1f2937')
    .text((entry) => (entry.value === null ? '-' : entry.value.toFixed(2)));

  root
    .selectAll('.corr-col-label')
    .data(curves)
    .enter()
    .append('text')
    .attr('class', 'corr-col-label')
    .attr('transform', (curve) => `translate(${xScale(curve) + xScale.bandwidth() / 2}, -8) rotate(-45)`)
    .attr('text-anchor', 'end')
    .style('font-size', '10px')
    .style('fill', 'var(--p-text-color, #333)')
    .text((curve) => curve);

  root
    .selectAll('.corr-row-label')
    .data(curves)
    .enter()
    .append('text')
    .attr('class', 'corr-row-label')
    .attr('x', -8)
    .attr('y', (curve) => yScale(curve) + yScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .style('font-size', '10px')
    .style('fill', 'var(--p-text-color, #333)')
    .text((curve) => curve);
}

onBeforeUnmount(() => {
  clearPlot();
  clearCorrelationHeatmap();
});
</script>

<template>
  <div class="las-workspace">
    <div class="las-workspace__sidebar">
      <div class="las-workspace__section">
        <h3 class="las-workspace__section-title">LAS File</h3>
        <Button
          label="Open LAS File"
          icon="pi pi-folder-open"
          severity="primary"
          size="small"
          :loading="isLoading"
          @click="handleOpenFile"
        />
      </div>

      <div v-if="sessionOptions.length > 1" class="las-workspace__section">
        <label class="las-workspace__label">Active Session</label>
        <Select
          v-model="activeSessionId"
          :options="sessionOptions"
          option-label="label"
          option-value="value"
          placeholder="Select session"
          class="las-workspace__select"
        />
      </div>

      <div v-if="activeSession" class="las-workspace__section">
        <h3 class="las-workspace__section-title">Session Info</h3>
        <dl class="las-workspace__meta">
          <dt>File</dt>
          <dd>{{ activeSession.fileName }}</dd>
          <dt>Size</dt>
          <dd>{{ activeSession.fileSizeDisplay || '-' }}</dd>
          <dt>Well</dt>
          <dd>{{ activeSession.wellName || '-' }}</dd>
          <dt>Index</dt>
          <dd>{{ activeSession.indexCurve }} {{ activeSession.depthUnit ? `(${activeSession.depthUnit})` : '' }}</dd>
          <dt>Rows</dt>
          <dd>{{ activeSession.rowCount?.toLocaleString() }}</dd>
          <dt>Curves</dt>
          <dd>{{ activeSession.curveCount }}</dd>
          <dt>Range</dt>
          <dd>{{ overview?.indexRangeDisplay || '-' }}</dd>
        </dl>
        <Button
          label="Close Session"
          icon="pi pi-times"
          severity="danger"
          text
          size="small"
          @click="handleCloseSession"
        />
      </div>

      <div v-if="curveOptions.length" class="las-workspace__section">
        <h3 class="las-workspace__section-title">Curves</h3>
        <div class="las-workspace__curve-actions">
          <Button label="All" text size="small" @click="selectAllCurves" />
          <Button label="None" text size="small" @click="clearSelection" />
        </div>
        <div class="las-workspace__curve-list">
          <label v-for="curve in curveOptions" :key="curve.mnemonic" class="las-workspace__curve-item">
            <Checkbox v-model="selectedCurveNames" :value="curve.mnemonic" :binary="false" />
            <span class="las-workspace__curve-label">{{ curve.label }}</span>
          </label>
        </div>
        <Button
          label="Plot Selected"
          icon="pi pi-chart-line"
          severity="primary"
          size="small"
          :disabled="!selectedCurveNames.length"
          :loading="isLoading"
          @click="handleFetchCurves"
          class="las-workspace__action-button"
        />
        <Button
          label="Curve Stats"
          icon="pi pi-table"
          severity="secondary"
          size="small"
          :disabled="!selectedCurveNames.length"
          :loading="isLoading"
          @click="handleFetchStatistics"
          class="las-workspace__action-button"
        />
        <Button
          label="Correlation"
          icon="pi pi-th-large"
          severity="secondary"
          size="small"
          :disabled="selectedCurveNames.length < 2"
          :loading="isLoading"
          @click="handleFetchCorrelation"
          class="las-workspace__action-button"
        />
      </div>
    </div>

    <div class="las-workspace__main">
      <Message v-if="storeError || plotError" severity="error" :closable="true" @close="lasStore.clearError(); plotError = null">
        <div class="las-workspace__error-message">
          <p class="las-workspace__error-text">{{ storeError || plotError }}</p>
          <p v-if="backendErrorContext" class="las-workspace__error-meta">{{ backendErrorContext }}</p>
          <pre v-if="storeErrorDetails" class="las-workspace__error-details">{{ storeErrorDetails }}</pre>
        </div>
      </Message>

      <div v-if="isLoading && !hasData" class="las-workspace__loading">
        <ProgressSpinner style="width: 48px; height: 48px" />
        <p>Loading...</p>
      </div>

      <div v-if="!activeSession && !isLoading" class="las-workspace__empty">
        <i class="pi pi-chart-bar las-workspace__empty-icon"></i>
        <p>Open a <strong>.las</strong> file to get started</p>
      </div>

      <div v-if="activeSession && !hasData && !isLoading" class="las-workspace__empty">
        <i class="pi pi-check-circle las-workspace__empty-icon"></i>
        <p>File parsed - select curves and click <strong>Plot Selected</strong></p>
      </div>

      <div v-if="activeSession" class="las-workspace__panel-grid">
        <section class="las-workspace__panel">
          <h4 class="las-workspace__panel-title">Overview</h4>
          <dl class="las-workspace__meta">
            <dt>Data Points</dt>
            <dd>{{ overview?.dataPoints?.toLocaleString() || '-' }}</dd>
            <dt>Index Type</dt>
            <dd>{{ overview?.indexDtype || '-' }}</dd>
            <dt>Index Min</dt>
            <dd>{{ overview?.indexMin ?? '-' }}</dd>
            <dt>Index Max</dt>
            <dd>{{ overview?.indexMax ?? '-' }}</dd>
            <dt>Index Range</dt>
            <dd>{{ overview?.indexRangeDisplay || '-' }}</dd>
          </dl>
        </section>

        <section class="las-workspace__panel">
          <h4 class="las-workspace__panel-title">Curve Details</h4>
          <DataTable :value="curveRanges" size="small" scrollable :rows="6" striped-rows>
            <Column field="curve" header="Curve" />
            <Column field="unit" header="Unit" />
            <Column field="range" header="Range" />
            <Column field="dataPoints" header="Data Points" />
            <Column field="description" header="Description" />
          </DataTable>
        </section>

        <section class="las-workspace__panel" v-if="wellSectionOptions.length">
          <h4 class="las-workspace__panel-title">Well Information</h4>
          <Select
            v-model="selectedWellSectionName"
            :options="wellSectionOptions"
            option-label="label"
            option-value="value"
            class="las-workspace__select"
          />
          <DataTable :value="wellSectionRows" size="small" scrollable :rows="6" striped-rows>
            <Column field="mnemonic" header="Mnemonic" />
            <Column field="value" header="Value" />
            <Column field="unit" header="Unit" />
            <Column field="description" header="Description" />
          </DataTable>
        </section>

        <section class="las-workspace__panel" v-if="dataPreview?.head?.length">
          <h4 class="las-workspace__panel-title">Data Preview</h4>
          <p class="las-workspace__panel-hint">
            Shape: {{ dataPreview.shape?.[0] ?? 0 }} x {{ dataPreview.shape?.[1] ?? 0 }}
          </p>
          <DataTable :value="dataPreview.head" size="small" scrollable :rows="6" striped-rows>
            <Column
              v-for="columnName in previewColumns"
              :key="columnName"
              :field="columnName"
              :header="columnName"
            />
          </DataTable>
        </section>

        <section class="las-workspace__panel" v-if="statisticsRows.length">
          <h4 class="las-workspace__panel-title">Curve Statistics</h4>
          <DataTable :value="statisticsRows" size="small" scrollable :rows="8" striped-rows>
            <Column field="metricLabel" header="Metric" />
            <Column v-for="columnName in statisticsColumns" :key="columnName" :header="columnName">
              <template #body="{ data }">
                {{ data.values?.[columnName] ?? 'N/A' }}
              </template>
            </Column>
          </DataTable>
        </section>

        <section class="las-workspace__panel" v-if="correlationMatrix?.matrix?.length">
          <h4 class="las-workspace__panel-title">Correlation Matrix</h4>
          <p class="las-workspace__panel-hint">
            Sample size: {{ correlationMatrix.sampleSize?.toLocaleString() || 0 }}
          </p>
          <div ref="correlationContainerRef" class="las-workspace__correlation"></div>
        </section>
      </div>

      <div ref="plotContainerRef" class="las-workspace__plot"></div>
    </div>
  </div>
</template>

<style scoped>
.las-workspace {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.las-workspace__sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  background: var(--color-surface-elevated, #fafafa);
  border: 1px solid var(--line, #e0e0e0);
  border-radius: var(--radius-lg, 8px);
  overflow-y: auto;
}

.las-workspace__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.las-workspace__section-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color, #666);
}

.las-workspace__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-muted-color, #666);
}

.las-workspace__select {
  width: 100%;
}

.las-workspace__meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0;
  font-size: 0.82rem;
}

.las-workspace__meta dt {
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.las-workspace__meta dd {
  margin: 0;
  word-break: break-word;
}

.las-workspace__curve-actions {
  display: flex;
  gap: 4px;
}

.las-workspace__curve-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.las-workspace__curve-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.las-workspace__curve-item:hover {
  background: color-mix(in srgb, var(--color-accent-primary, #3b82f6) 8%, transparent);
}

.las-workspace__curve-label {
  font-size: 0.82rem;
  user-select: none;
}

.las-workspace__action-button {
  margin-top: 2px;
}

.las-workspace__main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

.las-workspace__error-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.las-workspace__error-text {
  margin: 0;
}

.las-workspace__error-meta {
  margin: 0;
  font-size: 0.78rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.las-workspace__error-details {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--line, #ddd) 70%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-surface-elevated, #fff) 94%, black);
  font-size: 0.74rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.las-workspace__loading,
.las-workspace__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 280px;
  color: var(--p-text-muted-color, #888);
}

.las-workspace__empty-icon {
  font-size: 3rem;
  opacity: 0.3;
}

.las-workspace__panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

.las-workspace__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line, #ddd);
  border-radius: 8px;
  background: var(--color-surface-elevated, #fff);
  min-height: 0;
}

.las-workspace__panel-title {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color, #666);
}

.las-workspace__panel-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--p-text-muted-color, #777);
}

.las-workspace__correlation {
  min-height: 240px;
  overflow: auto;
}

.las-workspace__plot {
  min-height: 0;
}

.las-workspace__plot svg,
.las-workspace__correlation svg {
  display: block;
}

@media (max-width: 1024px) {
  .las-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
