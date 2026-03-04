import { defineStore } from 'pinia';
import { backendRequest, getBackendResultMeta, openLasFileDialog } from '@/composables/useBackendClient.js';

function normalizeRequestMeta(rawMeta, fallbackTask) {
    if (!rawMeta || typeof rawMeta !== 'object') {
        return {
            task: fallbackTask,
            requestId: null,
            elapsedMs: null,
            taskVersion: null,
            resultModelVersion: null,
        };
    }

    const elapsedMs = Number.isFinite(Number(rawMeta.elapsedMs)) ? Number(rawMeta.elapsedMs) : null;
    return {
        task: rawMeta.task || fallbackTask,
        requestId: rawMeta.requestId ?? null,
        elapsedMs,
        taskVersion: rawMeta.taskVersion ?? null,
        resultModelVersion: rawMeta.resultModelVersion ?? null,
    };
}

function normalizeBackendError(err, fallbackMessage, fallbackTask) {
    return {
        message: err?.message || fallbackMessage,
        code: err?.code || null,
        details: err?.details ?? null,
        requestMeta: normalizeRequestMeta(
            {
                task: err?.task || fallbackTask,
                requestId: err?.requestId ?? null,
                elapsedMs: err?.elapsedMs ?? null,
                taskVersion: err?.taskVersion ?? null,
                resultModelVersion: err?.resultModelVersion ?? null,
            },
            fallbackTask
        ),
    };
}

export const useLasStore = defineStore('las', {
    state: () => ({
        sessions: {},
        activeSessionId: null,
        curveData: {},
        curveStatistics: {},
        correlationMatrix: {},
        loading: false,
        error: null,
        errorCode: null,
        errorDetails: null,
        lastRequestMeta: null,
    }),

    getters: {
        activeSession(state) {
            if (!state.activeSessionId) return null;
            return state.sessions[state.activeSessionId] ?? null;
        },
        sessionList(state) {
            return Object.values(state.sessions);
        },
        activeCurves(state) {
            const session = this.activeSession;
            if (!session) return [];
            return session.curves ?? [];
        },
        activeSelectedCurves(state) {
            const session = this.activeSession;
            if (!session) return [];
            return session.selectedCurves ?? [];
        },
        activeCurveData(state) {
            if (!state.activeSessionId) return null;
            return state.curveData[state.activeSessionId] ?? null;
        },
        activeCurveStatistics(state) {
            if (!state.activeSessionId) return null;
            return state.curveStatistics[state.activeSessionId] ?? null;
        },
        activeCorrelationMatrix(state) {
            if (!state.activeSessionId) return null;
            return state.correlationMatrix[state.activeSessionId] ?? null;
        },
    },

    actions: {
        clearBackendStatus() {
            this.error = null;
            this.errorCode = null;
            this.errorDetails = null;
        },

        applyBackendError(err, fallbackMessage, fallbackTask) {
            const normalized = normalizeBackendError(err, fallbackMessage, fallbackTask);
            this.error = normalized.message;
            this.errorCode = normalized.code;
            this.errorDetails = normalized.details;
            this.lastRequestMeta = normalized.requestMeta;
        },

        setLastRequestMetaFromResult(result, fallbackTask) {
            this.lastRequestMeta = normalizeRequestMeta(getBackendResultMeta(result), fallbackTask);
        },

        async openAndParseFile() {
            const dialogResult = await openLasFileDialog();
            if (dialogResult.canceled) return null;
            return this.parseFile(dialogResult.filePath);
        },

        async parseFile(filePath) {
            this.loading = true;
            this.clearBackendStatus();
            try {
                const result = await backendRequest('las.parse_file', { filePath });
                const sessionId = result.sessionId;

                this.sessions[sessionId] = {
                    ...result,
                    filePath,
                    selectedCurves: [],
                };
                this.activeSessionId = sessionId;
                this.setLastRequestMetaFromResult(result, 'las.parse_file');
                return sessionId;
            } catch (err) {
                this.applyBackendError(err, 'Failed to parse LAS file.', 'las.parse_file');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchCurveData(curveNames, options = {}) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, session.indexCurve);
            if (!selectedCurveNames.length) {
                throw new Error('Select at least one non-index curve.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                    ...options,
                };
                const result = await backendRequest('las.get_curve_data', payload);
                this.curveData[session.sessionId] = result;
                this.setLastRequestMetaFromResult(result, 'las.get_curve_data');

                this.sessions[session.sessionId] = {
                    ...this.sessions[session.sessionId],
                    selectedCurves: [...selectedCurveNames],
                };

                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to fetch curve data.', 'las.get_curve_data');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchCurveStatistics(curveNames) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, session.indexCurve);
            if (!selectedCurveNames.length) {
                throw new Error('Select at least one non-index curve.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                };
                const result = await backendRequest('las.get_curve_statistics', payload);
                this.curveStatistics[session.sessionId] = result;
                this.setLastRequestMetaFromResult(result, 'las.get_curve_statistics');
                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to calculate curve statistics.', 'las.get_curve_statistics');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchCorrelationMatrix(curveNames, options = {}) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, session.indexCurve);
            if (selectedCurveNames.length < 2) {
                throw new Error('Select at least two non-index curves.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                    ...options,
                };
                const result = await backendRequest('las.get_correlation_matrix', payload);
                this.correlationMatrix[session.sessionId] = result;
                this.setLastRequestMetaFromResult(result, 'las.get_correlation_matrix');
                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to calculate correlation matrix.', 'las.get_correlation_matrix');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async deleteSession(sessionId) {
            const id = sessionId || this.activeSessionId;
            if (!id) return;

            try {
                await backendRequest('las.delete_session', { sessionId: id });
            } catch {
                // best-effort cleanup
            }

            delete this.sessions[id];
            delete this.curveData[id];
            delete this.curveStatistics[id];
            delete this.correlationMatrix[id];

            if (this.activeSessionId === id) {
                const remaining = Object.keys(this.sessions);
                this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
            }
        },

        setActiveSession(sessionId) {
            if (sessionId in this.sessions) {
                this.activeSessionId = sessionId;
            }
        },

        setSelectedCurves(curveNames) {
            if (!this.activeSessionId || !this.sessions[this.activeSessionId]) return;
            this.sessions[this.activeSessionId] = {
                ...this.sessions[this.activeSessionId],
                selectedCurves: [...curveNames],
            };
        },

        clearError() {
            this.clearBackendStatus();
        },
    },
});

function normalizeRequestedCurveNames(curveNames, indexCurve) {
    const requestedCurveNames = Array.isArray(curveNames)
        ? curveNames.map((curve) => String(curve).trim()).filter((curve) => curve.length > 0)
        : [];
    const uniqueCurveNames = [...new Set(requestedCurveNames)];
    if (!indexCurve) return uniqueCurveNames;
    return uniqueCurveNames.filter((curve) => curve !== indexCurve);
}
