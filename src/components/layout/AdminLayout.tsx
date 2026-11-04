import * as React from 'react'
import {useLocation, useParams} from 'react-router-dom'
import {cn} from '@/lib/utils'
import {topNavs} from '@/data/mock'
import {AdminTopHeader} from './AdminTopHeader'
import {AdminLeftSidebar, adminNavs} from './AdminLeftSidebar'
import {MenuEditorDialog} from './MenuEditorDialog'
import {getAppForm} from '@/services/appForms'
import {FormSettingsNav} from '@/components/biz/FormSettingsNav'
import {useAiAssistant} from '@/components/ai/AiProvider'
import {useAppDataRevision} from '@/lib/useAppDataRevision'

export function AdminLayout({
                              children,
                              noPadding,
                              contentClassName,
                              noOuterScroll,
                              hideHeader,
                            }: {
  children: React.ReactNode
  noPadding?: boolean
  contentClassName?: string
  noOuterScroll?: boolean
  hideHeader?: boolean
}) {
  const location = useLocation()
  const ai = useAiAssistant()
  const params = useParams<{appId: string; formName: string}>()
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(topNavs[0].id)
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)

  const showFormSidebar = /^\/admin\/apps\/[^/]+\/forms\//.test(location.pathname)
  const currentFormMatch = location.pathname.match(/^\/admin\/apps\/([^/]+)\/forms\/([^/]+)/)
  const currentAppId = currentFormMatch ? params.appId ?? currentFormMatch[1] : ''
  const currentFormName = currentFormMatch ? params.formName ?? currentFormMatch[2] : ''
  const formRevision = useAppDataRevision(currentAppId, ['form'], currentFormName)
  const [currentFormLabel, setCurrentFormLabel] = React.useState(currentFormName)

  React.useEffect(() => {
    if (!currentAppId || !currentFormName) {
      setCurrentFormLabel('')
      return
    }
    let cancelled = false
    setCurrentFormLabel(currentFormName)
    getAppForm(currentAppId, currentFormName)
      .then((form) => {
        if (!cancelled) setCurrentFormLabel(form.label)
      })
      .catch(() => {
        if (!cancelled) setCurrentFormLabel(currentFormName)
      })
    return () => {
      cancelled = true
    }
  }, [currentAppId, currentFormName, formRevision])

  const mobileNavs = showFormSidebar && currentFormName
    ? [
      ...adminNavs,
      {
        id: 'mobile-form',
        text: currentFormLabel,
        sub: [
          {
            id: 'mobile-form-base',
            text: '基本信息',
            to: `/admin/apps/${currentAppId}/forms/${currentFormName}/base`
          },
          {
            id: 'mobile-form-design',
            text: '表单设计',
            to: `/admin/apps/${currentAppId}/forms/${currentFormName}/form-design`
          },
          {
            id: 'mobile-form-fields',
            text: '字段管理',
            to: `/admin/apps/${currentAppId}/forms/${currentFormName}/fields`
          },
        ],
      },
    ]
    : adminNavs

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideHeader && <AdminTopHeader mobileNavs={mobileNavs}/>}

      {!hideHeader && (
        <AdminLeftSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditMenus={() => setMenuEditorOpen(true)}
        />
      )}

      <MenuEditorDialog
        open={menuEditorOpen}
        onOpenChange={setMenuEditorOpen}
        activeTopId={activeTopId}
        onActiveTopIdChange={setActiveTopId}
        onNavsChange={() => undefined}
      />

      {showFormSidebar && (
        <aside
          className={cn(
            'fixed bottom-6 top-[5.5rem] z-30 hidden w-56 overflow-hidden rounded-xl border bg-card lg:block',
            collapsed ? 'left-[5.5rem]' : 'left-[17.5rem]',
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <p className="mb-1 text-xs text-muted-foreground">表单设置</p>
              <div className="truncate text-base font-semibold text-foreground" title={currentFormLabel}>
                {currentFormLabel}
              </div>
              <p className="mb-0 mt-1 truncate font-mono text-xs text-muted-foreground">{currentFormName}</p>
            </div>
            <FormSettingsNav appId={currentAppId} formName={currentFormName}/>
          </div>
        </aside>
      )}

      <main
        className={cn(
          hideHeader ? 'mt-0 h-screen md:ml-0' : 'mt-16 h-[calc(100vh-4rem)]',
          noOuterScroll ? 'overflow-hidden' : 'overflow-y-auto',
          noPadding ? '' : 'px-4 pb-4 md:px-6 md:pb-6',
          hideHeader
            ? ''
            : showFormSidebar
              ? collapsed
                ? 'md:ml-16 lg:ml-[19rem]'
                : 'md:ml-64 lg:ml-[31rem]'
              : collapsed
                ? 'md:ml-16'
                : 'md:ml-64',
          !hideHeader && ai.panelOpen && 'lg:pr-[calc(var(--ai-panel-width)_+_1.5rem)]',
        )}
      >
        <div className={cn('w-full pt-4 md:pt-6', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}
