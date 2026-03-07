import {
    NODE_KIND_LEGACY_BORE,
    NODE_KIND_TUBING_INNER,
    TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';
import packerDefinition from '@/equipment/definitions/packer.definition.js';
import safetyValveDefinition from '@/equipment/definitions/safetyValve.definition.js';
import bridgePlugDefinition from '@/equipment/definitions/bridgePlug.definition.js';
import { normalizeToken } from '@/equipment/definitions/utils.js';

function normalizeDefinitionRecord(definition) {
    if (!definition || typeof definition !== 'object') return null;
    const schema = definition?.schema && typeof definition.schema === 'object'
        ? definition.schema
        : {};
    const defaults = definition?.defaults ?? schema?.defaults ?? null;
    const engineering = definition?.engineering && typeof definition.engineering === 'object'
        ? definition.engineering
        : {
            validate: typeof definition?.validate === 'function' ? definition.validate : undefined,
            resolveSealContext: typeof definition?.resolveSealContext === 'function'
                ? definition.resolveSealContext
                : undefined,
            suppressNoSealWarningCodes: Array.isArray(definition?.suppressNoSealWarningCodes)
                ? definition.suppressNoSealWarningCodes
                : [],
            resolveConnections: () => []
        };
    const host = definition?.host && typeof definition.host === 'object'
        ? definition.host
        : null;
    const render = definition?.render && typeof definition.render === 'object'
        ? definition.render
        : Object.freeze({ family: 'unknown' });
    const ui = definition?.ui && typeof definition.ui === 'object'
        ? definition.ui
        : Object.freeze({});

    return Object.freeze({
        ...definition,
        schema: Object.freeze({
            ...schema,
            defaults
        }),
        defaults,
        host,
        engineering: Object.freeze({
            validate: engineering?.validate,
            resolveSealContext: engineering?.resolveSealContext,
            suppressNoSealWarningCodes: Array.isArray(engineering?.suppressNoSealWarningCodes)
                ? Object.freeze([...engineering.suppressNoSealWarningCodes])
                : Object.freeze([]),
            resolveConnections: typeof engineering?.resolveConnections === 'function'
                ? engineering.resolveConnections
                : (() => [])
        }),
        render: Object.freeze({
            family: String(render?.family ?? 'unknown').trim() || 'unknown'
        }),
        ui: Object.freeze({
            inspectorFields: Array.isArray(ui?.inspectorFields) ? Object.freeze([...ui.inspectorFields]) : Object.freeze([]),
            resolveInspectorFields: typeof ui?.resolveInspectorFields === 'function'
                ? ui.resolveInspectorFields
                : null,
            editorFields: Array.isArray(ui?.editorFields) ? Object.freeze([...ui.editorFields]) : Object.freeze([]),
            resolveEditorFields: typeof ui?.resolveEditorFields === 'function'
                ? ui.resolveEditorFields
                : null
        })
    });
}

export function createEquipmentDefinitionRegistry(definitions = []) {
    const normalizedDefinitions = Object.freeze(
        (Array.isArray(definitions) ? definitions : [])
            .map((definition) => normalizeDefinitionRecord(definition))
            .filter(Boolean)
    );

    const definitionByKey = Object.freeze(
        normalizedDefinitions.reduce((accumulator, definition) => {
            const key = String(definition?.schema?.key ?? '').trim();
            if (key) accumulator[key] = definition;
            return accumulator;
        }, {})
    );

    function listDefinitions() {
        return normalizedDefinitions;
    }

    function normalizeTypeKey(value) {
        const token = normalizeToken(value);
        if (!token) return null;

        for (const definition of normalizedDefinitions) {
            const matchTokens = Array.isArray(definition?.schema?.matchTokens)
                ? definition.schema.matchTokens
                : [];
            if (matchTokens.some((matchToken) => token.includes(matchToken))) {
                return String(definition?.schema?.key ?? '').trim() || null;
            }
        }
        return token;
    }

    function resolveDefinitionByKey(typeKey) {
        const normalizedTypeKey = String(typeKey ?? '').trim();
        if (!normalizedTypeKey) return null;
        return definitionByKey[normalizedTypeKey] ?? null;
    }

    function resolveDefinition(typeValue) {
        return resolveDefinitionByKey(normalizeTypeKey(typeValue));
    }

    function resolveTypeLabel(typeValue, fallbackValue = null) {
        const definition = resolveDefinition(typeValue);
        const canonicalLabel = String(definition?.schema?.label ?? '').trim();
        if (canonicalLabel) return canonicalLabel;

        const fallback = fallbackValue === null ? typeValue : fallbackValue;
        return String(fallback ?? '').trim();
    }

    function resolveTypeDefaults(typeValue) {
        const definition = resolveDefinition(typeValue);
        return definition?.defaults ?? definition?.schema?.defaults ?? null;
    }

    function resolveTypeSealByVolume(typeValue) {
        const defaults = resolveTypeDefaults(typeValue);
        const resolvedSealByVolume = defaults?.sealByVolume;
        if (!resolvedSealByVolume || typeof resolvedSealByVolume !== 'object') return null;

        const normalized = {};
        TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
            normalized[volumeKey] = Boolean(resolvedSealByVolume[volumeKey]);
        });
        normalized[NODE_KIND_LEGACY_BORE] = Boolean(normalized[NODE_KIND_TUBING_INNER]);
        return normalized;
    }

    function resolveUiFields(typeValue, context, directKey, resolverKey) {
        const definition = resolveDefinition(typeValue);
        const uiConfig = definition?.ui;
        if (!uiConfig || typeof uiConfig !== 'object') return [];

        if (typeof uiConfig[resolverKey] === 'function') {
            const resolvedFields = uiConfig[resolverKey](context);
            return Array.isArray(resolvedFields) ? resolvedFields.filter(Boolean) : [];
        }

        if (Array.isArray(uiConfig[directKey])) {
            return uiConfig[directKey].filter(Boolean);
        }

        return [];
    }

    function resolveInspectorFields(typeValue, context = null) {
        return resolveUiFields(typeValue, context, 'inspectorFields', 'resolveInspectorFields');
    }

    function resolveEditorFields(typeValue, context = null) {
        return resolveUiFields(typeValue, context, 'editorFields', 'resolveEditorFields');
    }

    function resolveRenderConfig(typeValue) {
        const definition = resolveDefinition(typeValue);
        return definition?.render ?? Object.freeze({ family: 'unknown' });
    }

    function resolveHostConfig(typeValue) {
        const definition = resolveDefinition(typeValue);
        return definition?.host ?? null;
    }

    return Object.freeze({
        listDefinitions,
        normalizeTypeKey,
        resolveDefinition,
        resolveDefinitionByKey,
        resolveTypeLabel,
        resolveTypeDefaults,
        resolveTypeSealByVolume,
        resolveInspectorFields,
        resolveEditorFields,
        resolveRenderConfig,
        resolveHostConfig
    });
}

const equipmentDefinitionRegistry = createEquipmentDefinitionRegistry([
    packerDefinition,
    safetyValveDefinition,
    bridgePlugDefinition
]);

export const EQUIPMENT_TYPE_OPTIONS = Object.freeze(
    equipmentDefinitionRegistry
        .listDefinitions()
        .map((definition) => String(definition?.schema?.label ?? '').trim())
        .filter((label) => label.length > 0)
);

export function listEquipmentDefinitions() {
    return equipmentDefinitionRegistry.listDefinitions();
}

export function normalizeEquipmentTypeKey(value) {
    return equipmentDefinitionRegistry.normalizeTypeKey(value);
}

export function resolveEquipmentDefinitionByKey(typeKey) {
    return equipmentDefinitionRegistry.resolveDefinitionByKey(typeKey);
}

export function resolveEquipmentDefinition(typeValue) {
    return equipmentDefinitionRegistry.resolveDefinition(typeValue);
}

export function resolveEquipmentTypeLabel(typeValue, fallbackValue = null) {
    return equipmentDefinitionRegistry.resolveTypeLabel(typeValue, fallbackValue);
}

export function resolveEquipmentTypeDefaults(typeValue) {
    return equipmentDefinitionRegistry.resolveTypeDefaults(typeValue);
}

export function resolveEquipmentTypeSealByVolume(typeValue) {
    return equipmentDefinitionRegistry.resolveTypeSealByVolume(typeValue);
}

export function resolveEquipmentInspectorFields(typeValue, context = null) {
    return equipmentDefinitionRegistry.resolveInspectorFields(typeValue, context);
}

export function resolveEquipmentEditorFields(typeValue, context = null) {
    return equipmentDefinitionRegistry.resolveEditorFields(typeValue, context);
}

export function resolveEquipmentRenderConfig(typeValue) {
    return equipmentDefinitionRegistry.resolveRenderConfig(typeValue);
}

export function resolveEquipmentHostConfig(typeValue) {
    return equipmentDefinitionRegistry.resolveHostConfig(typeValue);
}

export default equipmentDefinitionRegistry;
