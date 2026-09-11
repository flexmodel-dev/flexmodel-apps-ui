import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RbLoading } from '@/components/rb/RbLoading'
import { fileTree, type FileNode } from '@/data/mock'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  Folder,
  Image,
  Presentation,
  Search,
  Share,
  Upload,
  type LucideIcon,
} from 'lucide-react'

function fileIconMeta(name: string, type: 'folder' | 'file') {
  if (type === 'folder') return { icon: Folder, className: 'text-[#fbbc05]' }

  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, { icon: LucideIcon; className: string }> = {
    pdf: { icon: FileText, className: 'text-[#ea4335]' },
    docx: { icon: FileText, className: 'text-primary' },
    doc: { icon: FileText, className: 'text-primary' },
    xlsx: { icon: File, className: 'text-[#34a853]' },
    xls: { icon: File, className: 'text-[#34a853]' },
    pptx: { icon: Presentation, className: 'text-[#ff6d00]' },
    png: { icon: Image, className: 'text-[#9575cd]' },
    jpg: { icon: Image, className: 'text-[#9575cd]' },
  }

  return map[ext ?? ''] ?? { icon: File, className: 'text-muted-foreground' }
}

/** 文件管理（复刻 files/docs.html：左侧目录树 + 文件面包屑/操作/网格视图） */
export default function FilesDocs() {
  const [current, setCurrent] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<string[]>([])
  const [showTree, setShowTree] = React.useState(true)
  const [keyword, setKeyword] = React.useState('')
  React.useEffect(() => {
    setLoading(true)
    setSelected([])
    const timer = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(timer)
  }, [current])

  const nodes = React.useMemo(() => {
    const next = (fileTree[current] ?? []).filter((item) =>
      keyword ? item.name.toLowerCase().includes(keyword.toLowerCase()) : true,
    )

    return next
  }, [current, keyword])

  const folders = nodes.filter((item) => item.type === 'folder')
  const files = nodes.filter((item) => item.type === 'file')
  const allSelected = nodes.length > 0 && selected.length === nodes.length

  const breadcrumb = React.useMemo(() => {
    if (!current) return [{ id: '', name: '全部文件' }]

    for (const [parentId, list] of Object.entries(fileTree)) {
      const hit = list.find((item) => item.id === current)
      if (hit) {
        const parent = parentId
          ? (fileTree[parentId] ?? []).find((item) => item.id === parentId)
          : undefined
        return [
          { id: parentId, name: parent?.name ?? '全部文件' },
          { id: current, name: hit.name },
        ]
      }
    }
    return [{ id: '', name: '全部文件' }]
  }, [current])

  const toggleAll = () =>
    setSelected(allSelected ? [] : nodes.map((item) => item.id))
  const toggleOne = (id: string) =>
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    )

  return (
    <AppLayout noPadding noOuterScroll contentClassName="h-full min-h-0">
      <div className="flex h-full min-h-0">
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r bg-card transition-[width] md:flex',
            showTree ? 'w-[240px]' : 'w-0 overflow-hidden',
          )}
        >
          <div className="border-b px-3 pb-3 pt-4">
            <ul className="mb-1 flex list-none items-center gap-1 border-b border-border">
              <li className="-mb-px border-b-2 border-primary px-3 pb-2 pt-1.5 text-sm font-medium">文件</li>
              <li className="-mb-px border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-muted-foreground">附件</li>
            </ul>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
                current === '' && 'bg-primary/10 text-primary',
              )}
              onClick={() => setCurrent('')}
            >
              <Folder className="h-4 w-4 shrink-0 text-[#fbbc05]" />
              <span className="min-w-0 flex-1 truncate">全部文件</span>
            </button>

            {(fileTree[''] ?? [])
              .filter((item) => item.type === 'folder')
              .map((folder) => (
                <div key={folder.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
                      current === folder.id && 'bg-primary/10 text-primary',
                    )}
                    onClick={() => setCurrent(folder.id)}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-[#fbbc05]" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{folder.fileCount}</span>
                  </button>

                  {(fileTree[folder.id] ?? [])
                    .filter((item) => item.type === 'folder')
                    .map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg py-2 pl-9 pr-3 text-left transition-colors hover:bg-accent',
                          current === child.id && 'bg-primary/10 text-primary',
                        )}
                        onClick={() => setCurrent(child.id)}
                      >
                        <Folder className="h-4 w-4 shrink-0 text-[#fbbc05]" />
                        <span className="min-w-0 flex-1 truncate">{child.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{child.fileCount}</span>
                      </button>
                    ))}
                </div>
              ))}
          </div>
        </aside>

        <div className="main-content container-fluid flex min-w-0 flex-1 flex-col">
          <div className="file-header">
            <div className="flex h-[44px] items-center bg-muted px-5 py-2">
              <ol className="m-0 flex list-none items-center gap-1 bg-transparent text-sm text-muted-foreground">
                {breadcrumb.map((item, index) => (
                  <li key={item.id || index} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#ccc]" />}
                    <a
                      className={cn(
                        index === breadcrumb.length - 1
                          ? 'text-foreground'
                          : 'cursor-pointer hover:text-primary',
                      )}
                      onClick={() => index < breadcrumb.length - 1 && setCurrent(item.id)}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-[20px] py-[13px]">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center" title="全选/反选">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                </label>
                <div className="flex">
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="h-10 w-[220px] rounded-l-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="搜索"
                  />
                  <Button variant="secondary" className="rounded-l-none border-l border-[#d5d5d5]">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button><Upload className="h-4 w-4" /> 上传文件</Button>
                <Button variant="secondary" className="!px-2">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="secondary">默认排序 <ChevronDown className="h-4 w-4" /></Button>
                <Button variant="secondary"><Share className="h-4 w-4" /> 分享列表</Button>
              </div>
            </div>
          </div>

          <div className="file-viewport min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <RbLoading center />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {folders.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary',
                        selected.includes(item.id) && 'border-primary bg-accent',
                      )}
                      onClick={() => setCurrent(item.id)}
                    >
                      {(() => {
                        const icon = fileIconMeta(item.name, 'folder')
                        return <icon.icon className={cn('h-8 w-8', icon.className)} />
                      })()}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.fileCount} 个文件</div>
                      </div>
                    </div>
                  ))}
                </div>

                {folders.length > 0 && files.length > 0 && <div className="my-4 border-t" />}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary',
                        selected.includes(item.id) && 'border-primary bg-accent',
                      )}
                      onClick={() => toggleOne(item.id)}
                    >
                      {(() => {
                        const icon = fileIconMeta(item.name, 'file')
                        return <icon.icon className={cn('h-8 w-8', icon.className)} />
                      })()}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.size} · {item.modifiedOn.slice(0, 10)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {nodes.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">目录为空</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
