import {requestJson} from '@/services/http'
import {createAppDataCache} from '@/services/appDataCache'
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
  metric: string
}

export interface WorkbenchChartConfig {
  type: 'chart'
  chartType: WorkbenchChartType
  formName: string
  dimensionField: string
  measureField?: string
  aggregation: WorkbenchAggregationType
  showLegend: boolean
  showLabel: boolean
  smooth: boolean
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
  label: string
  description: string
  defaultWidth: number
  defaultHeight: number
  requiredFields: string[]
  defaultConfig: Record<string, unknown>
}

export interface WorkbenchCapability {
  schemaVersion: number
  components: WorkbenchComponentSpec[]
  forms: WorkbenchFormOption[]
  shortcutMenus: Array<{ id: string; name: string }>
  availableValues: Record<string, string[]>
  exampleLayout: WorkbenchLayout
}

const API_BASE = '/api/apps'
const listCache = createAppDataCache<WorkbenchSummary[]>()
const detailCache = createAppDataCache<Workbench>()
const capabilityCache = createAppDataCache<WorkbenchCapability>()

function detailKey(appId: string, workbenchId: string) {
  return `${appId}:${workbenchId}`
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
      components: Array.isArray(workbench.layout.components) ? workbench.layout.components : [],
    },
  }
}

function invalidateWorkbenchCaches(appId: string, workbenchId?: string) {
  listCache.delete(appId)
  capabilityCache.delete(appId)
  if (workbenchId) detailCache.delete(detailKey(appId, workbenchId))
  invalidateAppMenuTargets(appId)
}

export async function getWorkbenches(appId: string): Promise<WorkbenchSummary[]> {
  let request = listCache.get(appId)
  if (!request) {
    request = requestJson<WorkbenchSummary[]>(`${API_BASE}/${appId}/workbenches`)
      .catch((caught: unknown) => {
        listCache.delete(appId)
        throw caught
      })
    listCache.set(appId, request)
  }
  return request
}

export async function getWorkbenchCapabilities(appId: string): Promise<WorkbenchCapability> {
  let request = capabilityCache.get(appId)
  if (!request) {
    request = requestJson<WorkbenchCapability>(`${API_BASE}/${appId}/workbenches/capabilities`)
      .catch((caught: unknown) => {
        capabilityCache.delete(appId)
        throw caught
      })
    capabilityCache.set(appId, request)
  }
  return request
}

export async function getWorkbench(appId: string, workbenchId: string): Promise<Workbench> {
  const key = detailKey(appId, workbenchId)
  let request = detailCache.get(key)
  if (!request) {
    request = requestJson<Workbench>(`${API_BASE}/${appId}/workbenches/${encodeURIComponent(workbenchId)}`)
      .then(normalizeWorkbench)
      .catch((caught: unknown) => {
        detailCache.delete(key)
        throw caught
      })
    detailCache.set(key, request)
  }
  return request
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
