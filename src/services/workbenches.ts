import {requestJson} from '@/services/http'
import {createAppDataCache} from '@/services/appDataCache'
import {invalidateAppMenuTargets} from '@/services/appMenus'

export type WorkbenchComponentType =
  | 'index'
  | 'line'
  | 'bar'
  | 'pie'
  | 'dataloader'
  | 'shortcuts'
  | 'tasks'

export type WorkbenchAggregationType = 'count' | 'sum' | 'avg'

export const WORKBENCH_GRID_COLUMNS = 12
export const WORKBENCH_MAX_GRID_HEIGHT = 24

export interface WorkbenchComponentConfig {
  formName?: string
  dimensionField?: string
  measureField?: string
  aggregation?: WorkbenchAggregationType
  showLegend?: boolean
  showLabel?: boolean
  smooth?: boolean
  palette?: 'primary' | 'multi'
  metric?: string
  visibleColumns?: string[]
  shortcuts?: string[]
  columnsPerRow?: number
}

export interface WorkbenchComponent {
  id: string
  title: string
  type: WorkbenchComponentType
  config?: WorkbenchComponentConfig
}

export interface WorkbenchLayoutItem {
  componentId: string
  x: number
  y: number
  w: number
  h: number
}

export interface WorkbenchLayout {
  components: WorkbenchComponent[]
  items: WorkbenchLayoutItem[]
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

const API_BASE = '/api/apps'
const listCache = createAppDataCache<WorkbenchSummary[]>()
const detailCache = createAppDataCache<Workbench>()

function detailKey(appId: string, workbenchId: string) {
  return `${appId}:${workbenchId}`
}

function normalizeComponent(component: WorkbenchComponent): WorkbenchComponent {
  return {
    ...component,
    config: component.config ?? {},
  }
}

function normalizeWorkbench(workbench: Workbench): Workbench {
  const components = Array.isArray(workbench.layout?.components)
    ? workbench.layout.components.map(normalizeComponent)
    : []
  return {
    ...workbench,
    description: workbench.description ?? '',
    layout: {
      components,
      items: Array.isArray(workbench.layout?.items) ? workbench.layout.items : [],
    },
  }
}

function invalidateWorkbenchCaches(appId: string, workbenchId?: string) {
  listCache.delete(appId)
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
