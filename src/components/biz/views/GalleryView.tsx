import * as React from 'react'
import {ImageOff, Pencil, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {AppLoading} from '@/components/biz/AppLoading'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import {attachmentUrls} from '@/lib/attachments'
import {formatFieldValue} from '@/lib/fieldConfig'
import type {AppFormField} from '@/services/appForms'
import {cn} from '@/lib/utils'

/** 画廊视图：图片封面卡片网格，自适应列数，无封面时显示占位。 */
export function GalleryView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick} = props
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(30)

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'RECORDS',
    page,
    size,
    search,
    filter: advancedFilter,
  }, refreshTick)

  const rows = query.data?.list ?? []
  const total = query.data?.total ?? 0
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const summaryFields = viewDisplayFields(form, view)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
    .filter((field) => field.name !== view.config.coverField)
    .slice(0, 4)
  const fit = view.config.imageFit ?? 'COVER'

  const coverUrl = (record: Record<string, unknown>): string | null => {
    const coverField = view.config.coverField
    if (!coverField) return null
    const urls = attachmentUrls(record[coverField])
    return urls[0] ?? null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="record-list-scroll min-h-0 flex-1 overflow-y-auto pb-1">
        {query.isLoading ? (
          <AppLoading center className="min-h-[240px]"/>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rows.map((row) => {
              const recordId = String(row.id)
              const cover = coverUrl(row)
              return (
                <div
                  key={recordId}
                  className="group/card overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
                >
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => props.onOpenRecord(recordId)}
                  >
                    <div className={cn(
                      'flex h-36 items-center justify-center overflow-hidden bg-muted',
                      fit === 'COVER' ? 'object-cover' : 'object-contain',
                    )}>
                      {cover ? (
                        <img
                          src={cover}
                          alt={viewTitleValue(form, view, row)}
                          loading="lazy"
                          className={cn('h-full w-full', fit === 'COVER' ? 'object-cover' : 'object-contain')}
                          onError={(event) => {
                            (event.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <ImageOff className="h-8 w-8 text-muted-foreground/50"/>
                      )}
                    </div>
                  </button>
                  <div className="space-y-1 p-3">
                    <button
                      type="button"
                      className="block w-full truncate text-left text-sm font-medium text-primary hover:underline"
                      onClick={() => props.onOpenRecord(recordId)}
                    >
                      {viewTitleValue(form, view, row)}
                    </button>
                    {summaryFields.map((field) => {
                      const value = row[field.name]
                      const text = value == null || value === '' ? '-' : formatFieldValue(field, value)
                      return (
                        <div key={field.name} className="truncate text-xs text-muted-foreground" title={text}>
                          {field.label}：{text}
                        </div>
                      )
                    })}
                    <div
                      className="flex items-center justify-end gap-1 pt-1 opacity-0 transition-opacity group-hover/card:opacity-100">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6" title="编辑"
                        onClick={() => props.onOpenRecord(recordId, 'edit')}
                      >
                        <Pencil className="h-3 w-3"/>
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive" title="删除"
                        onClick={() => props.onRequestDelete(recordId)}
                      >
                        <Trash2 className="h-3 w-3"/>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!query.isLoading && rows.length === 0 && <Empty description="暂无数据"/>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Pagination
          page={page}
          pages={Math.max(1, Math.ceil(total / size))}
          total={total}
          size={size}
          onChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize)
            setPage(1)
          }}
          className="w-full"
        />
      </div>
    </div>
  )
}
