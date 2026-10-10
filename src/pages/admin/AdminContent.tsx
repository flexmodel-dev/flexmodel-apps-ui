import * as React from 'react'
import { Link } from 'react-router-dom'
import { CirclePlus } from 'lucide-react'
import {
  type AppApprovalFlow,
  type AppTriggerConfig,
  type BusinessObjectMeta
} from '@/data/mock'

export function BusinessObjectManagementContent({businessObjects}: { businessObjects: BusinessObjectMeta[] }) {
  return (
    <div className="row -mx-2.5" id="businessObjectList">
      <div className="new-business-object mb-5 w-full px-2.5">
        <h3 className="mb-4 text-base font-normal text-muted-foreground">表单管理</h3>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-6">
          {businessObjects.map((businessObject) => (
            <Link
              key={businessObject.name}
              to={`/admin/business-object/${businessObject.name}/base`}
              className="block rounded-md border bg-card transition-colors hover:bg-accent"
            >
              <div className="card-body p-3">
                <div className="float-left w-[30px] text-center">
                  <businessObject.icon className="h-7 w-7 text-primary"/>
                </div>
                <div className="ml-7">
                  <span className="block truncate text-sm font-medium">{businessObject.label}</span>
                  <p className="mb-0 mt-0.5 truncate text-xs text-muted-foreground">{businessObject.description}</p>
                </div>
              </div>
              <div className="badge-wrap absolute right-[11px] top-[13px]">
                <span className="badge-secondary">{businessObject.badge}</span>
              </div>
            </Link>
          ))}
          <a className="block cursor-pointer rounded-md border border-dashed border-input transition-colors hover:border-primary">
            <div className="card-body p-3 pt-1 text-center">
              <CirclePlus className="h-6 w-6 text-primary" />
              <span className="mt-1 block text-xs text-muted-foreground">新建表单</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}

export function ApprovalFlowsContent({ rows }: { rows: AppApprovalFlow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {row.businessObject} · {row.applies} · {row.modifiedOn}
            </div>
          </div>
          <span className={row.state === '启用' ? 'text-sm text-green-600' : 'text-sm text-muted-foreground'}>● {row.state}</span>
        </div>
      ))}
    </div>
  )
}

export function TriggerRulesContent({ rows }: { rows: AppTriggerConfig[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {row.businessObject} · {row.when} · {row.action}
            </div>
          </div>
          <span className={row.state === '启用' ? 'text-sm text-green-600' : 'text-sm text-muted-foreground'}>● {row.state}</span>
        </div>
      ))}
    </div>
  )
}
