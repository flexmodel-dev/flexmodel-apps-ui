import * as React from 'react'
import {ImageOff, MoreHorizontal, Pencil, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Pagination} from '@/components/biz/Pagination'
import {Empty} from '@/components/ui/empty'
import {useViewQuery} from '@/components/biz/views/useViewQuery'
import {type ViewComponentProps, viewDisplayFields, viewTitleValue} from '@/components/biz/views/types'
import {
  DEFAULT_VIEW_PAGE_SIZE,
  layoutFieldLabel,
  recordFieldText,
  VIEW_PAGE_SIZE_OPTIONS,
} from '@/components/biz/views/viewUtils'
import {ViewErrorState, ViewFetchingBar, ViewInlineError, ViewSkeleton} from '@/components/biz/views/viewFeedback'
import {attachmentPreviewType, attachmentUrls} from '@/lib/attachments'
import {useAttachmentImageSource} from '@/components/biz/form/AttachmentField'
import {AppLoading} from '@/components/biz/AppLoading'
import type {AppForm, AppFormField, AppFormViewTab} from '@/services/appForms'
import type {AppRecord} from '@/services/appRecords'
import {cn} from '@/lib/utils'

function GalleryCard({
                       form,
                       view,
                       record,
                       summaryFields,
                       onOpen,
                       onEdit,
                       onDelete,
                     }: {
  form: AppForm
  view: AppFormViewTab
  record: AppRecord
  summaryFields: AppFormField[]
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const recordId = String(record.id)
  const coverField = view.config.coverField
  const cover = coverField ? attachmentUrls(record[coverField])[0] ?? null : null
  const coverIsImage = Boolean(cover && attachmentPreviewType(cover)?.startsWith('image/'))
  const {source, error: coverError} = useAttachmentImageSource(cover ?? '', coverIsImage)
  const fit = view.config.imageFit ?? 'COVER'

  return (
    <article
      className="group/card relative cursor-pointer overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md focus-within:ring-1 focus-within:ring-ring"
      onClick={onOpen}
      data-record-id={recordId}
    >
      <div className="relative h-36 overflow-hidden bg-muted">
        {source ? (
          <img
            src={source}
            alt={viewTitleValue(form, view, record)}
            className={cn('h-full w-full', fit === 'COVER' ? 'object-cover' : 'object-contain')}
          />
        ) : coverIsImage && !coverError ? (
          <div className="flex h-full items-center justify-center">
            <AppLoading size="sm" label="正在加载封面"/>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/50"/>
          </div>
        )}
        <div
          className="absolute right-1.5 top-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary" size="icon" className="h-7 w-7 border bg-card/90 shadow-sm"
                aria-label={`记录「${viewTitleValue(form, view, record)}」更多操作`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4"/>编辑
              </DropdownMenuItem>
              <DropdownMenuSeparator/>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4"/>删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <button
          type="button"
          className="block w-full truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          {viewTitleValue(form, view, record)}
        </button>
        {summaryFields.map((field) => {
          const text = recordFieldText(field, record[field.name])
          return (
            <div key={field.name} className="truncate text-xs text-muted-foreground" title={text}>
              <span className="text-muted-foreground/80">{layoutFieldLabel(form, field.name, field.label)}：</span>
              {text}
            </div>
          )
        })}
      </div>
    </article>
  )
}

/** 画廊视图：图片封面卡片网格，自适应列数，无封面时显示占位。 */
export function GalleryView(props: ViewComponentProps) {
  const {appId, form, view, search, advancedFilter, refreshTick} = props
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState(DEFAULT_VIEW_PAGE_SIZE)

  const query = useViewQuery(appId, form.name, view.id, {
    scope: 'RECORDS',
    page,
    size,
    search,
    filter: advancedFilter,
  }, refreshTick)

  const rows = query.data?.list ?? []
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const isInitialLoading = query.isLoading && !query.data
  const fieldMap = new Map(form.fields.map((field) => [field.name, field]))
  const summaryFields = viewDisplayFields(form, view)
    .map((name) => fieldMap.get(name))
    .filter((field): field is AppFormField => Boolean(field))
    .filter((field) => field.name !== view.config.coverField)
    .slice(0, 4)

  React.useEffect(() => {
    setPage(1)
  }, [search, advancedFilter, view.filter])

  React.useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  if (query.error && !query.data) {
    return <ViewErrorState message={query.error} onRetry={query.reload}/>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="record-list-scroll relative min-h-0 flex-1 overflow-y-auto pb-1">
        <ViewFetchingBar active={query.isFetching && !query.isLoading}/>
        {query.error && <ViewInlineError message={query.error} onRetry={query.reload}/>}
        {isInitialLoading ? (
          <ViewSkeleton variant="cards" rows={10}/>
        ) : rows.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rows.map((row) => (
              <GalleryCard
                key={String(row.id)}
                form={form}
                view={view}
                record={row}
                summaryFields={summaryFields}
                onOpen={() => props.onOpenRecord(String(row.id))}
                onEdit={() => props.onOpenRecord(String(row.id), 'edit')}
                onDelete={() => props.onRequestDelete(String(row.id))}
              />
            ))}
          </div>
        ) : (
          <Empty className="min-h-[240px]" description="暂无数据"/>
        )}
      </div>
      {!isInitialLoading && (
        <div className="mt-2 flex items-center justify-between">
          <Pagination
            page={page}
            pages={pages}
            total={total}
            size={size}
            sizeOptions={VIEW_PAGE_SIZE_OPTIONS}
            onChange={setPage}
            onSizeChange={(nextSize) => {
              setSize(nextSize)
              setPage(1)
            }}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}
