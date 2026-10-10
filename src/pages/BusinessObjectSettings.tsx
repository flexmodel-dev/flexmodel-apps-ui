import * as React from 'react'
import {useParams} from 'react-router-dom'
import {AdminLayout} from '@/components/layout/AdminLayout'
import {Empty} from '@/components/ui/empty'
import {getBusinessObject} from '@/data/mock'

const sections = {
  base: '基本信息',
  fields: '字段管理',
  'easy-action': '自定义操作',
  'record-alerts': '记录锁定',
  advanced: '高级配置',
} as const

export type BusinessObjectSettingsSection = keyof typeof sections

export default function BusinessObjectSettings({section}: { section: BusinessObjectSettingsSection }) {
  const {businessObject = ''} = useParams<{ businessObject: string }>()
  const meta = getBusinessObject(businessObject)

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="m-0 text-xl font-semibold text-foreground">{meta?.label ?? '表单'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sections[section]}</p>
        <div className="mt-6 rounded-xl border bg-card">
          {meta ? (
            <Empty description={`${sections[section]}功能开发中`}/>
          ) : (
            <Empty description="表单不存在"/>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
