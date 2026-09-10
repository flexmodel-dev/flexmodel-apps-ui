import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RbLoading } from '@/components/rb/RbLoading'
import { fileTree, type FileNode } from '@/data/mock'
import { cn } from '@/lib/utils'

function fileIconCls(name: string, type: 'folder' | 'file') {
  if (type === 'folder') return 'zmdi-folder text-[#fbbc05] text-[34px]'
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: 'zmdi-file-text text-[#ea4335]',
    docx: 'zmdi-file-text text-primary',
    doc: 'zmdi-file-text text-primary',
    xlsx: 'zmdi-file text-[#34a853]',
    xls: 'zmdi-file text-[#34a853]',
    pptx: 'zmdi-collection-text text-[#ff6d00]',
    png: 'zmdi-image text-[#9575cd]',
    jpg: 'zmdi-image text-[#9575cd]',
  }
  return `${map[ext ?? ''] ?? 'zmdi-file text-[#8a8a8a]'} text-[30px]`
}

/** 文件管理（复刻 files/docs.html：左侧目录树 + 文件面包屑/操作/网格视图） */
export default function FilesDocs() {
  const [current, setCurrent] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<string[]>([])
  const [showTree, setShowTree] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    setSelected([])
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [current])

  const nodes: FileNode[] = fileTree[current] ?? []
  const breadcrumb = current
    ? (() => {
        // 找父级名称链（简化：一层）
        for (const [k, list] of Object.entries(fileTree)) {
          const hit = list.find((n) => n.id === current)
          if (hit) return [{ id: '', name: '全部文件' }, { id: current, name: hit.name }]
        }
        return [{ id: '', name: '全部文件' }]
      })()
    : [{ id: '', name: '全部文件' }]

  const folders = nodes.filter((n) => n.type === 'folder')
  const files = nodes.filter((n) => n.type === 'file')

  return (
    <AppLayout noPadding>
      <div className="flex h-full">
        {/* 左侧目录树 */}
        <aside className={cn('hidden shrink-0 border-r bg-card transition-all md:block', showTree ? 'w-[220px]' : 'w-0 overflow-hidden')}>
          <div className="px-2 pt-3">
            <div className="tab-container">
              <ul className="mb-2 flex list-none items-center gap-1 border-b border-[#e3e3e3] dark:border-[#2e3340]">
                <li className="-mb-px border-b-2 border-primary px-3 py-1.5 text-sm">文件</li>
                <li className="-mb-px border-b-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground">附件</li>
              </ul>
              <div className="rb-scroller max-h-[calc(100vh-150px)] overflow-y-auto py-2 text-[13px]">
                <div className="cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent">
                  <i className="zmdi zmdi-folder mr-1.5 text-[#fbbc05]" />全部文件
                </div>
                {(fileTree[''] ?? []).filter((n) => n.type === 'folder').map((f) => (
                  <div key={f.id} className="pl-1">
                    <div
                      className={cn('cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent', current === f.id && 'bg-accent text-accent-foreground')}
                      onClick={() => setCurrent(f.id)}
                    >
                      <i className="zmdi zmdi-folder mr-1.5 text-[#fbbc05]" />
                      {f.name}
                      <span className="ml-1 text-xs text-[#bbb]">{f.fileCount}</span>
                    </div>
                    {/* 二级 */}
                    {(fileTree[f.id] ?? []).filter((n) => n.type === 'folder').map((s) => (
                      <div key={s.id} className="cursor-pointer rounded-md py-1.5 pl-7 pr-2 hover:bg-accent">
                        <i className="zmdi zmdi-folder mr-1.5 text-[#fbbc05]" />{s.name}
                        <span className="ml-1 text-xs text-[#bbb]">{s.fileCount}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 主内容 */}
        <div className="main-content container-fluid min-w-0 flex-1">
          {/* 面包屑 + 操作条 */}
          <div className="file-header">
            <div className="flex h-[44px] items-center bg-muted px-5 py-2">
              <ol className="m-0 flex list-none items-center gap-1 bg-transparent text-sm text-muted-foreground">
                {breadcrumb.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-1">
                    {i > 0 && <i className="zmdi zmdi-chevron-right text-[14px] text-[#ccc]" />}
                    <a className={cn(i === breadcrumb.length - 1 ? 'text-foreground' : 'cursor-pointer hover:text-primary')} onClick={() => i < breadcrumb.length - 1 && setCurrent(b.id)}>
                      {b.name}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-[20px] py-[13px]">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center" title="全选/反选">
                  <Checkbox checked={selected.length === nodes.length && nodes.length > 0} onCheckedChange={() => setSelected(selected.length === nodes.length ? [] : nodes.map((n) => n.id))} />
                </label>
                <div className="flex">
                  <input
                    className="h-10 w-[220px] rounded-l-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="搜索"
                  />
                  <Button variant="secondary" className="rounded-l-none border-l border-[#d5d5d5]">
                    <i className="icon zmdi zmdi-search" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button><i className="icon zmdi zmdi-upload text-[16px]" /> 上传文件</Button>
                <Button variant="secondary" className="!px-2">
                  <i className="icon zmdi zmdi-chevron-down text-[16px]" />
                </Button>
                <Button variant="secondary">默认排序 <i className="icon zmdi zmdi-chevron-down text-[16px]" /></Button>
                <Button variant="secondary"><i className="icon zmdi zmdi-share text-[15px]" /> 分享列表</Button>
              </div>
            </div>
          </div>

          {/* 文件区 */}
          <div className="file-viewport p-4">
            {loading ? (
              <RbLoading center />
            ) : (
              <>
                {/* 文件夹 */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {folders.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary',
                        selected.includes(f.id) && 'border-primary bg-accent'
                      )}
                      onClick={() => setCurrent(f.id)}
                    >
                      <i className={cn('zmdi text-[34px]', fileIconCls(f.name, 'folder'))} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{f.fileCount} 个文件</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* 文件 */}
                {folders.length > 0 && files.length > 0 && <div className="my-4 border-t" />}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary',
                        selected.includes(f.id) && 'border-primary bg-accent'
                      )}
                      onClick={() => setSelected((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                    >
                      <i className={cn('zmdi', fileIconCls(f.name, 'file'))} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{f.size} · {f.modifiedOn.slice(0, 10)}</div>
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
