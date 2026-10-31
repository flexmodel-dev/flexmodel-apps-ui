import {requestJson} from '@/services/http'
import type {AppPackagePreview} from '@/services/appPackages'

export interface AppTemplateSummary {
  id: string
  name: string
  description: string
  category?: string | null
  iconName?: string | null
  formCount: number
  includesData: boolean
  exportedAt?: string | null
}

const base = '/api/app-packages/templates'

/** 内置应用模板目录：坏模板由服务端启动时跳过，这里只拿到可用条目。 */
export function listAppTemplates(): Promise<AppTemplateSummary[]> {
  return requestJson(base)
}

/** 从模板创建服务端暂存导入，返回与上传导入一致的预览结构。 */
export function instantiateAppTemplate(templateId: string): Promise<AppPackagePreview> {
  return requestJson(`${base}/${encodeURIComponent(templateId)}/imports`, {method: 'POST'})
}
