import {requestJson} from '@/services/http'
import {cachedFetch, createAppDataCache} from '@/services/appDataCache'
import {invalidateAppMenuTargets} from '@/services/appMenus'

export const WORKBENCH_SCHEMA_VERSION = 1
export const WORKBENCH_GRID_COLUMNS = 12
export const WORKBENCH_MAX_GRID_HEIGHT = 24

export type WorkbenchComponentType = 'metric' | 'chart' | 'dataloader' | 'shortcuts' | 'tasks'
export type WorkbenchChartType = 'line' | 'bar' | 'pie'
export type WorkbenchAggregationType = 'count' | 'sum' | 'avg'
export type WorkbenchPaletteType = 'primary' | 'multi'

export interface WorkbenchPlacement {
  x: number
  y: number
  w: number
  h: number
}

export interface WorkbenchMetricConfig {
  type: 'metric'
  formName: string
  aggregation: WorkbenchAggregationType
  field?: string | null
}

export interface WorkbenchChartConfig {
  type: 'chart'
  chartType: WorkbenchChartType
  formName: string
  dimensionField: string
  measureField?: string | null
  aggregation: WorkbenchAggregationType
  showLegend: boolean
  showLabel: boolean
  smooth?: boolean | null
  palette: WorkbenchPaletteType
}

export interface WorkbenchDataLoaderConfig {
  type: 'dataloader'
  formName: string
  visibleColumns: string[]
}

export interface WorkbenchShortcutsConfig {
  type: 'shortcuts'
  shortcuts: string[]
  columnsPerRow: number
}

export interface WorkbenchTasksConfig {
  type: 'tasks'
}

export type WorkbenchComponentConfig =
  | WorkbenchMetricConfig
  | WorkbenchChartConfig
  | WorkbenchDataLoaderConfig
  | WorkbenchShortcutsConfig
  | WorkbenchTasksConfig

export interface WorkbenchComponent {
  id: string
  title: string
  placement: WorkbenchPlacement
  config: WorkbenchComponentConfig
}

export interface WorkbenchLayout {
  schemaVersion: number
  components: WorkbenchComponent[]
}

export interface Workbench {
  id: string
  name: string
  description?: string | null
  layout: WorkbenchLayout
  createdAt?: string | null
  updatedAt?: string | null
}

export interface WorkbenchSummary {
  id: string
  name: string
  description?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface WorkbenchCreateInput {
  name: string
  description?: string | null
  layout?: WorkbenchLayout | null
}

/**
 * PATCH 传参：仅提交需要修改的字段。
 * - 未提交字段保持不变；
 * - description 提交 null 表示清空；
 * - name/layout 不允许提交 null。
 */
export interface WorkbenchPatchInput {
  name?: string
  description?: string | null
  layout?: WorkbenchLayout
}

export interface WorkbenchFieldOption {
  name: string
  label: string
  type: string
  measure: boolean
}

export interface WorkbenchFormOption {
  name: string
  label: string
  displayField: string
  fields: WorkbenchFieldOption[]
}

export interface WorkbenchComponentSpec {
  type: WorkbenchComponentType
  chartType?: WorkbenchChartType | null
  label: string
  description: string
  defaultWidth: number
  defaultHeight: number
  requiredFields: string[]
  defaultConfig: Record<string, unknown>
  dataEndpoint?: string | null
}

export interface WorkbenchCapability {
  schemaVersion: number
  components: WorkbenchComponentSpec[]
  forms: WorkbenchFormOption[]
  shortcutMenus: Array<{ id: string; name: string }>
  availableValues: Record<string, string[]>
  exampleLayout: WorkbenchLayout
}

export interface WorkbenchDataPoint {
  dimension: string
  value: number
}

export type WorkbenchComponentData =
  | { type: 'metric'; value: number }
  | { type: 'chart'; rows: WorkbenchDataPoint[] }
  | { type: 'dataloader'; list: Array<Record<string, unknown>>; total: number }

export interface WorkbenchComponentDataResponse {
  componentId: string
  data: WorkbenchComponentData
}

export interface WorkbenchComponentDataQuery {
  page?: number
  size?: number
  search?: string
}

const API_BASE = '/api/apps'
const listCache = createAppDataCache<WorkbenchSummary[]>()
const detailCache = createAppDataCache<Workbench>()
const capabilityCache = createAppDataCache<WorkbenchCapability>()

function detailKey(appId: string, workbenchId: string) {
  return `${appId}:${workbenchId}`
}

function normalizeComponentConfig(config: WorkbenchComponentConfig): WorkbenchComponentConfig {
  if (config.type === 'metric') {
    const aggregation = config.aggregation ?? 'count'
    return {
      ...config,
      aggregation,
      field: aggregation === 'count' ? null : (config.field ?? null),
    }
  }
  if (config.type === 'chart') {
    const aggregation = config.aggregation ?? 'count'
    return {
      ...config,
      aggregation,
      measureField: aggregation === 'count' ? null : (config.measureField ?? null),
      showLegend: config.showLegend ?? (config.chartType === 'pie'),
      showLabel: config.showLabel ?? true,
      smooth: config.chartType === 'line' ? (config.smooth ?? true) : undefined,
      palette: config.palette ?? (config.chartType === 'pie' ? 'multi' : 'primary'),
    }
  }
  return config
}
function normalizeWorkbench(workbench: Workbench): Workbench {
  if (!workbench.layout) {
    throw new Error('工作台布局缺失')
  }
  return {
    ...workbench,
    description: workbench.description ?? '',
    layout: {
      schemaVersion: workbench.layout.schemaVersion,
      components: Array.isArray(workbench.layout.components)
        ? workbench.layout.components.map((component) => ({
          ...component,
          config: normalizeComponentConfig(component.config),
        }))
        : [],
    },
  }
}

function invalidateWorkbenchCaches(appId: string, workbenchId?: string) {
  listCache.delete(appId)
  capabilityCache.delete(appId)
  if (workbenchId) detailCache.delete(detailKey(appId, workbenchId))
  invalidateAppMenuTargets(appId)
}

export function getWorkbenches(appId: string): Promise<WorkbenchSummary[]> {
  return cachedFetch(listCache, appId, () =>
    requestJson<WorkbenchSummary[]>(`${API_BASE}/${appId}/workbenches`))
}

export function getWorkbenchCapabilities(appId: string): Promise<WorkbenchCapability> {
  return cachedFetch(capabilityCache, appId, () =>
    requestJson<WorkbenchCapability>(`${API_BASE}/${appId}/workbenches/capabilities`))
}

export function getWorkbench(appId: string, workbenchId: string): Promise<Workbench> {
  return cachedFetch(detailCache, detailKey(appId, workbenchId), () =>
    requestJson<Workbench>(`${API_BASE}/${appId}/workbenches/${encodeURIComponent(workbenchId)}`)
      .then(normalizeWorkbench))
}

export async function createWorkbench(
  appId: string,
  input: WorkbenchCreateInput,
): Promise<Workbench> {
  const workbench = normalizeWorkbench(await requestJson<Workbench>(
    `${API_BASE}/${appId}/workbenches`,
    {method: 'POST', body: JSON.stringify(input)},
  ))
  invalidateWorkbenchCaches(appId, workbench.id)
  return workbench
}

export async function patchWorkbench(
  appId: string,
  workbenchId: string,
  input: WorkbenchPatchInput,
): Promise<Workbench> {
  const workbench = normalizeWorkbench(await requestJson<Workbench>(
    `${API_BASE}/${appId}/workbenches/${encodeURIComponent(workbenchId)}`,
    {method: 'PATCH', body: JSON.stringify(input)},
  ))
  invalidateWorkbenchCaches(appId, workbenchId)
  detailCache.set(detailKey(appId, workbenchId), Promise.resolve(workbench))
  return workbench
}

export async function deleteWorkbench(appId: string, workbenchId: string): Promise<void> {
  await requestJson<null>(`${API_BASE}/${appId}/workbenches/${encodeURIComponent(workbenchId)}`, {
    method: 'DELETE',
  })
  invalidateWorkbenchCaches(appId, workbenchId)
}

export async function getWorkbenchComponentData(
  appId: string,
  workbenchId: string,
  componentId: string,
  query: WorkbenchComponentDataQuery = {},
): Promise<WorkbenchComponentDataResponse> {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.size !== undefined) params.set('size', String(query.size))
  if (query.search?.trim()) params.set('search', query.search.trim())
  const queryText = params.size ? `?${params}` : ''
  return requestJson<WorkbenchComponentDataResponse>(
    `${API_BASE}/${appId}/workbenches/${encodeURIComponent(workbenchId)}` +
    `/components/${encodeURIComponent(componentId)}/data${queryText}`,
  )
}
