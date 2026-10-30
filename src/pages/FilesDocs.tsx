import * as React from 'react'
import {useParams} from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {Input} from '@/components/ui/input'
import {BizDialog, ConfirmDialog} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {AppLoading} from '@/components/biz/AppLoading'
import {DirectoryMemberPicker} from '@/components/biz/DirectoryMemberPicker'
import type {DirectorySelection} from '@/types/directory'
import {attachmentName} from '@/lib/attachments'
import {cn, toErrorMessage} from '@/lib/utils'
import {getAppById} from '@/services/apps'
import {
  createStorageFolder,
  getStorageFolderMembers,
  updateStorageFolder,
  deleteStorageObject,
  downloadStorageObject,
  listStorageObjects,
  moveStorageObject,
  uploadStorageObject,
  type StorageObject,
} from '@/services/attachments'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  Image,
  Info,
  MoreHorizontal,
  Pencil,
  Presentation,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react'

type TabKey = 'files' | 'attachments'
type FileSort = 'newest' | 'oldest' | 'largest' | 'nameAsc' | 'nameDesc'
const DEFAULT_SORT: FileSort = 'newest'

const SORT_OPTIONS: Array<{value: FileSort; label: string}> = [
  {value: 'newest', label: '最近上传'},
  {value: 'oldest', label: '最早上传'},
  {value: 'largest', label: '较大文件'},
  {value: 'nameAsc', label: '文件名称 (A-Z)'},
  {value: 'nameDesc', label: '文件名称 (Z-A)'},
]
const fileNameCollator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'})

interface StorageNode {
  id: string
  name: string
  type: 'folder' | 'file'
  path: string
  size: number | null
  modifiedOn: string | null
  restricted: boolean
}

const ROOT_LABEL: Record<TabKey, string> = {
  files: '全部文件',
  attachments: '全部附件',
}

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, '')
}

function toNode(item: StorageObject): StorageNode {
  const path = normalizePath(item.path || item.name)
  return {
    id: path,
    path,
    type: item.type,
    name: item.type === 'file' ? attachmentName(item.name) : item.name,
    size: item.size,
    modifiedOn: item.lastModified,
    restricted: item.restricted === true,
  }
}

function formatSize(size: number | null) {
  if (size === null) return '—'
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function pathName(path: string) {
  return path.split('/').pop() ?? path
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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

/**
 * 文件管理（复刻 files/docs.html：左侧目录树 + 文件面包屑/操作/网格视图）
 *
 * 文件页签读取项目默认 Bucket 根目录（所有应用共享文件）；
 * 附件页签读取当前应用前缀（appId/）下由表单上传的附件。
 */
export default function FilesDocs() {
  const {appId} = useParams<{ appId?: string }>()
  const [tab, setTab] = React.useState<TabKey>('files')
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [appResolved, setAppResolved] = React.useState(!appId)
  const [current, setCurrent] = React.useState('')
  const [tree, setTree] = React.useState<Record<string, StorageNode[]>>({})
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selected, setSelected] = React.useState<string[]>([])
  const [keyword, setKeyword] = React.useState('')
  const [sortBy, setSortBy] = React.useState<FileSort>(DEFAULT_SORT)
  const [busy, setBusy] = React.useState(false)
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState('')
  const [folderError, setFolderError] = React.useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteTargets, setDeleteTargets] = React.useState<StorageNode[]>([])
  const [deleteError, setDeleteError] = React.useState('')
  const [menuFor, setMenuFor] = React.useState<string | null>(null)
  const [moveDialogOpen, setMoveDialogOpen] = React.useState(false)
  const [moveDest, setMoveDest] = React.useState('')
  const [moveNodes, setMoveNodes] = React.useState<StorageNode[]>([])
  const [moveLoading, setMoveLoading] = React.useState(false)
  const [moveError, setMoveError] = React.useState('')
  const [detailNode, setDetailNode] = React.useState<StorageNode | null>(null)
  const [editingNode, setEditingNode] = React.useState<StorageNode | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editMembers, setEditMembers] = React.useState<DirectorySelection[]>([])
  const [editReady, setEditReady] = React.useState(false)
  const [editLoading, setEditLoading] = React.useState(false)
  const editRequestRef = React.useRef(0)
  const [editError, setEditError] = React.useState('')
  const showTree = true
  const requestRef = React.useRef(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const menuCloseTimer = React.useRef<number | null>(null)

  const cancelMenuClose = () => {
    if (menuCloseTimer.current !== null) {
      window.clearTimeout(menuCloseTimer.current)
      menuCloseTimer.current = null
    }
  }

  const scheduleMenuClose = () => {
    cancelMenuClose()
    menuCloseTimer.current = window.setTimeout(() => setMenuFor(null), 200)
  }

  React.useEffect(() => () => {
    if (menuCloseTimer.current !== null) window.clearTimeout(menuCloseTimer.current)
  }, [])

  const scopePrefix = tab === 'attachments' && appId ? `${appId}/` : ''
  const readOnly: boolean = tab === 'attachments'

  React.useEffect(() => {
    if (!appId) {
      setProjectId(null)
      setAppResolved(true)
      return
    }
    let cancelled = false
    setAppResolved(false)
    setProjectId(null)
    getAppById(appId)
      .then((app) => {
        if (cancelled) return
        setProjectId(app.projectId)
        setAppResolved(true)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setProjectId(null)
        setAppResolved(true)
        setError(toErrorMessage(caught, '加载应用信息失败'))
      })
    return () => {
      cancelled = true
    }
  }, [appId])

  const fetchNodes = React.useCallback(async (path: string) => {
    if (!projectId) return []
    const items = await listStorageObjects(projectId, path || scopePrefix)
    let nodes = items.map(toNode).filter((node) => node.path)
    if (!path && tab === 'files' && appId) {
      // 根目录下的 appId 目录是附件存储区，不属于共享文件
      nodes = nodes.filter((node) => !(node.type === 'folder' && node.path === appId))
    }
    return nodes
  }, [projectId, scopePrefix, tab, appId])

  React.useEffect(() => {
    setCurrent('')
    setSelected([])
    setTree({})
    setError('')
    if (!appResolved) {
      setLoading(true)
      return
    }
    if (!projectId) {
      setLoading(false)
      if (!appId) setError('请从应用内打开文件管理')
      return
    }

    let cancelled = false
    const requestId = ++requestRef.current
    setLoading(true)
    fetchNodes('')
      .then((nodes) => {
        if (cancelled || requestId !== requestRef.current) return
        setTree({'': nodes})
      })
      .catch((caught: unknown) => {
        if (cancelled || requestId !== requestRef.current) return
        setError(toErrorMessage(caught, '加载文件失败'))
      })
      .finally(() => {
        if (cancelled || requestId !== requestRef.current) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [appResolved, appId, projectId, tab, fetchNodes])

  // 预加载根目录及当前目录下子文件夹，用于侧栏文件数统计
  React.useEffect(() => {
    if (!projectId) return
    const paths = new Set<string>()
    const pending = [...(tree[''] ?? []), ...(tree[current] ?? [])].filter((node) => {
      if (node.type !== 'folder' || tree[node.path] !== undefined || paths.has(node.path)) return false
      paths.add(node.path)
      return true
    })
    if (!pending.length) return

    let cancelled = false
    void Promise.all(pending.map(async (folder) => {
      try {
        return {path: folder.path, nodes: (await listStorageObjects(projectId, folder.path)).map(toNode)}
      } catch {
        return null
      }
    })).then((results) => {
      if (cancelled) return
      setTree((previous) => {
        const next = {...previous}
        for (const result of results) {
          if (result && next[result.path] === undefined) next[result.path] = result.nodes
        }
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [projectId, current, tree])

  const nodes = React.useMemo(() => {
    const list = tree[current] ?? []
    const filtered = keyword
      ? list.filter((item) => item.name.toLowerCase().includes(keyword.toLowerCase()))
      : list
    return [...filtered].sort((left, right) => {
      const byName = fileNameCollator.compare(left.name, right.name) || left.path.localeCompare(right.path)
      if (sortBy === 'nameAsc') return byName
      if (sortBy === 'nameDesc') return -byName
      const leftValue = sortBy === 'largest' ? left.size : Date.parse(left.modifiedOn ?? '')
      const rightValue = sortBy === 'largest' ? right.size : Date.parse(right.modifiedOn ?? '')
      if (leftValue === null || !Number.isFinite(leftValue)) {
        return rightValue === null || !Number.isFinite(rightValue) ? byName : 1
      }
      if (rightValue === null || !Number.isFinite(rightValue)) return -1
      return (leftValue - rightValue) * (sortBy === 'oldest' ? 1 : -1) || byName
    })
  }, [tree, current, keyword, sortBy])

  const folders = nodes.filter((item) => item.type === 'folder')
  const files = nodes.filter((item) => item.type === 'file')
  const allSelected = nodes.length > 0 && selected.length === nodes.length
  const selectedNodes = (tree[current] ?? []).filter((item) => selected.includes(item.id))
  const currentBase = current || (tab === 'attachments' && appId ? appId : '')

  const fileCount = React.useCallback(
    (path: string) => (tree[path] ?? []).filter((item) => item.type === 'file').length,
    [tree],
  )

  const breadcrumb = React.useMemo(() => {
    const crumbs = [{id: '', name: ROOT_LABEL[tab]}]
    let relative = current
    if (tab === 'attachments' && appId) {
      if (relative === appId) relative = ''
      else if (relative.startsWith(`${appId}/`)) relative = relative.slice(appId.length + 1)
    }
    let accumulated = tab === 'attachments' && appId ? appId : ''
    for (const segment of relative.split('/').filter(Boolean)) {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment
      crumbs.push({id: accumulated, name: segment})
    }
    return crumbs
  }, [current, tab, appId])

  const moveBreadcrumb = React.useMemo(() => {
    const crumbs = [{id: '', name: ROOT_LABEL[tab]}]
    let relative = moveDest
    if (tab === 'attachments' && appId) {
      if (relative === appId) relative = ''
      else if (relative.startsWith(`${appId}/`)) relative = relative.slice(appId.length + 1)
    }
    let accumulated = tab === 'attachments' && appId ? appId : ''
    for (const segment of relative.split('/').filter(Boolean)) {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment
      crumbs.push({id: accumulated, name: segment})
    }
    return crumbs
  }, [moveDest, tab, appId])

  const openFolder = (path: string) => {
    const target = normalizePath(path)
    const requestId = ++requestRef.current
    setCurrent(target)
    setSelected([])
    setError('')
    if (!projectId || tree[target] !== undefined) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchNodes(target)
      .then((items) => {
        if (requestId !== requestRef.current) return
        setTree((previous) => ({...previous, [target]: items}))
      })
      .catch((caught: unknown) => {
        if (requestId !== requestRef.current) return
        setError(toErrorMessage(caught, '加载文件失败'))
      })
      .finally(() => {
        if (requestId !== requestRef.current) return
        setLoading(false)
      })
  }

  const refreshPath = async (path: string) => {
    if (!projectId) return
    const refreshed = await fetchNodes(path)
    setTree((previous) => ({...previous, [path]: refreshed}))
  }

  const invalidatePaths = (paths: string[]) => {
    if (!paths.length) return
    setTree((previous) => {
      const next = {...previous}
      for (const key of Object.keys(next)) {
        if (paths.some((path) => key === path || key.startsWith(`${path}/`))) delete next[key]
      }
      return next
    })
  }

  const pickFiles = () => fileInputRef.current?.click()

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!filesToUpload.length || !projectId || readOnly) return

    setUploading(true)
    setError('')
    try {
      for (const file of filesToUpload) {
        const safeName = file.name.replace(/[\\/\u0000-\u001f\u007f]/g, '_')
        const storedName = tab === 'attachments' ? `${crypto.randomUUID()}_${safeName}` : safeName
        await uploadStorageObject(projectId, currentBase ? `${currentBase}/${storedName}` : storedName, file)
      }
      await refreshPath(current)
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  const openFolderDialog = () => {
    if (readOnly) return
    setFolderName('')
    setFolderError('')
    setFolderDialogOpen(true)
  }

  const handleCreateFolder = async () => {
    if (!projectId || readOnly) return
    const name = folderName.trim()
    if (!name) {
      setFolderError('请输入目录名称')
      return
    }
    if (/[\\/\u0000-\u001f\u007f]/.test(name) || name === '.' || name === '..') {
      setFolderError('目录名称不能包含斜杠等特殊字符')
      return
    }
    if ((tree[current] ?? []).some((item) => item.type === 'folder' && item.name === name)) {
      setFolderError('同名目录已存在')
      return
    }

    setBusy(true)
    setFolderError('')
    try {
      await createStorageFolder(projectId, currentBase ? `${currentBase}/${name}` : name)
      setFolderDialogOpen(false)
      await refreshPath(current)
    } catch (caught: unknown) {
      setFolderError(toErrorMessage(caught, '新建目录失败'))
    } finally {
      setBusy(false)
    }
  }

  const openDeleteDialog = (targets: StorageNode[]) => {
    if (readOnly) return
    cancelMenuClose()
    setMenuFor(null)
    setDeleteTargets(targets)
    setDeleteError('')
    setDeleteDialogOpen(true)
  }

  const openEditNode = async (node: StorageNode) => {
    if (!projectId || readOnly) return
    cancelMenuClose()
    setMenuFor(null)
    const requestId = ++editRequestRef.current
    setEditingNode(node)
    setEditName(pathName(node.path))
    setEditMembers([])
    setEditError('')
    setEditReady(node.type === 'file')
    setEditLoading(node.type === 'folder')
    if (node.type === 'file') return
    try {
      const members = await getStorageFolderMembers(projectId, node.path)
      if (!Array.isArray(members)) throw new Error('加载目录权限失败')
      if (requestId === editRequestRef.current) {setEditMembers(members); setEditReady(true)}
    } catch (caught) {
      if (requestId === editRequestRef.current) setEditError(toErrorMessage(caught, '加载目录权限失败'))
    } finally {
      if (requestId === editRequestRef.current) setEditLoading(false)
    }
  }

  const handleEditNode = async () => {
    if (!projectId || !editingNode || readOnly || busy || !editReady) return
    const name = editName.trim()
    if (!name || /[\\/\u0000-\u001f\u007f]/.test(name) || name === '.' || name === '..') {
      setEditError('请输入有效的名称，不能包含斜杠等特殊字符')
      return
    }
    setBusy(true)
    setEditError('')
    setError('')
    let saved = false
    try {
      const parent = editingNode.path.split('/').slice(0, -1).join('/')
      const target = parent ? parent + '/' + name : name
      if (editingNode.type === 'folder') await updateStorageFolder(projectId, editingNode.path, name, editMembers)
      else if (target !== editingNode.path) await moveStorageObject(projectId, editingNode.path, target)
      saved = true
      const nextCurrent = editingNode.type === 'folder' && (current === editingNode.path || current.startsWith(`${editingNode.path}/`))
        ? target + current.slice(editingNode.path.length) : current
      ++requestRef.current
      setCurrent(nextCurrent)
      setSelected([])
      setTree({})
      setEditingNode(null)
      const paths = [...new Set(['', parent, nextCurrent])]
      const entries = await Promise.all(paths.map(async path => [path, await fetchNodes(path)] as const))
      setTree(Object.fromEntries(entries))
    } catch (caught) {
      const message = toErrorMessage(caught, '保存失败')
      if (saved) setError('已保存，但刷新失败，请重新打开目录')
      else setEditError(message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!projectId || !deleteTargets.length || readOnly) return
    setBusy(true)
    setDeleteError('')
    const removed: string[] = []
    const failed: StorageNode[] = []
    const failures: string[] = []
    for (const node of deleteTargets) {
      try {
        await deleteStorageObject(projectId, node.path)
        removed.push(node.path)
      } catch (caught: unknown) {
        failed.push(node)
        failures.push(`${node.name}：${toErrorMessage(caught, '删除失败')}`)
      }
    }

    invalidatePaths(removed)
    setSelected(failed.map((node) => node.id))
    try {
      const removedCurrent = removed.find(path => current === path || current.startsWith(`${path}/`))
      const nextCurrent = removedCurrent ? removedCurrent.split('/').slice(0, -1).join('/') : current
      if (removedCurrent) {
        ++requestRef.current
        setCurrent(nextCurrent)
      }
      const parents = removed.map(path => path.split('/').slice(0, -1).join('/'))
      await Promise.all([...new Set([nextCurrent, ...parents])].map(refreshPath))
    } catch {
      // 列表刷新失败时保留已有内容，删除结果以错误提示为准
    }
    if (failures.length) {
      setDeleteError(failures.join('；'))
    } else {
      setDeleteDialogOpen(false)
      setDeleteTargets([])
    }
    setBusy(false)
  }

  const isMoveSource = (path: string) =>
    selectedNodes.some((node) => path === node.path || path.startsWith(`${node.path}/`))

  const loadMoveDir = async (path: string) => {
    if (!projectId) return
    setMoveDest(path)
    setMoveLoading(true)
    setMoveError('')
    try {
      const children = await fetchNodes(path)
      setMoveNodes(children.filter((item) => item.type === 'folder' && !isMoveSource(item.path)))
    } catch (caught: unknown) {
      setMoveNodes([])
      setMoveError(toErrorMessage(caught, '加载目录失败'))
    } finally {
      setMoveLoading(false)
    }
  }

  const openMoveDialog = () => {
    if (readOnly) return
    setMoveError('')
    setMoveDialogOpen(true)
    void loadMoveDir('')
  }

  const handleMove = async () => {
    if (!projectId || !selectedNodes.length || readOnly) return
    const destination = moveDest ? moveDest : (tab === 'attachments' && appId ? appId : '')
    setBusy(true)
    setMoveError('')
    const moved: string[] = []
    const failed: StorageNode[] = []
    const failures: string[] = []
    for (const node of selectedNodes) {
      const name = pathName(node.path)
      try {
        await moveStorageObject(projectId, node.path, destination ? `${destination}/${name}` : name)
        moved.push(node.path)
      } catch (caught: unknown) {
        failed.push(node)
        failures.push(`${node.name}：${toErrorMessage(caught, '移动失败')}`)
      }
    }

    invalidatePaths(moved)
    setSelected(failed.map((node) => node.id))
    const destinationPath = tab === 'attachments' && moveDest === appId ? '' : moveDest
    await Promise.all([...new Set([current, destinationPath])].map((path) =>
      refreshPath(path).catch(() => undefined)))

    if (failures.length) {
      setMoveError(failures.join('；'))
    } else {
      setMoveDialogOpen(false)
    }
    setBusy(false)
  }

  const saveSelected = async (node: StorageNode, collected: Array<{ path: string; name: string }>): Promise<void> => {
    if (!projectId) return
    if (node.type === 'file') {
      collected.push({path: node.path, name: attachmentName(pathName(node.path))})
      return
    }
    const children = await listStorageObjects(projectId, node.path)
    for (const child of children) {
      await saveSelected(toNode(child), collected)
    }
  }

  const handleDownload = async () => {
    if (!projectId || !selectedNodes.length) return
    setBusy(true)
    setError('')
    try {
      const collected: Array<{ path: string; name: string }> = []
      for (const node of selectedNodes) {
        await saveSelected(node, collected)
      }
      for (const file of collected) {
        const blob = await downloadStorageObject(projectId, file.path)
        saveBlob(blob, file.name)
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    } catch (caught: unknown) {
      setError(toErrorMessage(caught, '下载失败'))
    } finally {
      setBusy(false)
    }
  }

  const toggleAll = () =>
    setSelected(allSelected ? [] : nodes.map((item) => item.id))
  const toggleOne = (id: string) =>
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    )

  const renderTreeFolder = (folder: StorageNode, nested = false) => {
    const editing = editingNode?.path === folder.path
    const deleting = deleteDialogOpen && deleteTargets.some(target => target.path === folder.path)
    return (
      <div key={folder.id} className={cn('group relative flex items-center rounded-lg hover:bg-accent',
        current === folder.path && 'bg-primary/10 text-primary')}>
        <button type="button" className={cn('flex min-w-0 flex-1 items-center gap-2 py-2 pr-10 text-left', nested ? 'pl-9' : 'pl-3')}
          onClick={() => openFolder(folder.path)}>
          <Folder className="h-4 w-4 shrink-0 text-[#fbbc05]"/>
          <span className="flex min-w-0 items-center gap-0.5">
            <span className="truncate">{folder.name}</span>
            {folder.restricted && <span role="img" aria-label="已配置权限" title="已配置权限" className="shrink-0 text-muted-foreground">
              <ShieldCheck className="h-3 w-3" aria-hidden="true"/>
            </span>}
          </span>
          {tree[folder.path] !== undefined && <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground',
            !readOnly && 'group-hover:invisible group-focus-within:invisible [@media(hover:none)]:invisible',
            (editing || deleting || menuFor === `tree:${folder.path}`) && 'invisible')}>{fileCount(folder.path)}</span>}
        </button>
        {!readOnly && renderObjectMenu(folder, 'tree')}
      </div>
    )
  }

  const renderObjectMenu = (item: StorageNode, location: 'tree' | 'card' = 'card') => {
    const menuId = `${location}:${item.path}`
    const active = menuFor === menuId || editingNode?.path === item.path
      || deleteDialogOpen && deleteTargets.some(target => target.path === item.path)
    return (
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu
          open={menuFor === menuId}
          modal={false}
          onOpenChange={(open) => {
            cancelMenuClose()
            setMenuFor(open ? menuId : null)
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="更多操作"
              aria-label={`更多操作：${item.name}`}
              disabled={busy}
              className={cn(
                'rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
                active && 'opacity-100',
              )}
              onMouseEnter={() => {
                cancelMenuClose()
                setMenuFor(menuId)
              }}
              onMouseLeave={scheduleMenuClose}
            >
              <MoreHorizontal className="h-4 w-4"/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-32"
            onMouseEnter={cancelMenuClose}
            onMouseLeave={scheduleMenuClose}
          >
            <DropdownMenuItem
              onSelect={() => {
                cancelMenuClose()
                setMenuFor(null)
                setDetailNode(item)
              }}
            >
              <Info className="h-4 w-4"/> 详情
            </DropdownMenuItem>
            {!readOnly && (
              <DropdownMenuItem onSelect={() => void openEditNode(item)}>
                <Pencil className="h-4 w-4"/> 编辑
              </DropdownMenuItem>
            )}
            {!readOnly && (
              <DropdownMenuItem
                onSelect={() => openDeleteDialog([item])}
              >
                <Trash2 className="h-4 w-4"/> 删除
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

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
              {(['files', 'attachments'] as TabKey[]).map((key) => (
                <li
                  key={key}
                  className={cn(
                    '-mb-px cursor-pointer border-b-2 px-3 pb-2 pt-1.5 text-sm',
                    tab === key
                      ? 'border-primary font-medium'
                      : 'border-transparent text-muted-foreground',
                  )}
                  onClick={() => tab !== key && setTab(key)}
                >
                  {key === 'files' ? '文件' : '附件'}
                </li>
              ))}
            </ul>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
                current === '' && 'bg-primary/10 text-primary',
              )}
              onClick={() => openFolder('')}
            >
              <Folder className="h-4 w-4 shrink-0 text-[#fbbc05]" />
              <span className="min-w-0 flex-1 truncate">{ROOT_LABEL[tab]}</span>
            </button>

            {(tree[''] ?? [])
              .filter((item) => item.type === 'folder')
              .map((folder) => (
                <div key={folder.id}>
                  {renderTreeFolder(folder)}
                  {(tree[folder.path] ?? []).filter(item => item.type === 'folder').map(child => renderTreeFolder(child, true))}
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
                      onClick={() => index < breadcrumb.length - 1 && openFolder(item.id)}
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
                <Button
                  onClick={pickFiles}
                  disabled={!projectId || uploading || busy || readOnly}
                  title={readOnly ? '附件由表单上传，仅支持查看' : undefined}
                >
                  <Upload className="h-4 w-4"/> {uploading ? '上传中…' : '上传文件'}
                </Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload}/>
                <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="!px-2" title="更多操作" disabled={!projectId || busy}>
                      <ChevronDown className="h-4 w-4"/>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      disabled={readOnly}
                      title={readOnly ? '附件仅支持查看' : undefined}
                      onSelect={() => {
                        setActionsOpen(false)
                        openFolderDialog()
                      }}
                    >
                      <FolderPlus className="h-4 w-4"/> 新建目录
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!selectedNodes.length || readOnly}
                      title={readOnly ? '附件仅支持查看' : undefined}
                      onSelect={() => {
                        setActionsOpen(false)
                        openMoveDialog()
                      }}
                    >
                      <FolderInput className="h-4 w-4"/> 移动文件
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!selectedNodes.length || readOnly}
                      title={readOnly ? '附件仅支持查看' : undefined}
                      onSelect={() => {
                        setActionsOpen(false)
                        openDeleteDialog(selectedNodes)
                      }}
                    >
                      <Trash2 className="h-4 w-4"/> 删除
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!selectedNodes.length}
                      onSelect={() => {
                        setActionsOpen(false)
                        void handleDownload()
                      }}
                    >
                      <Download className="h-4 w-4"/> 批量下载
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" aria-label="文件排序" title="排序方式（默认：最近上传）">
                      {SORT_OPTIONS.find(option => option.value === sortBy)?.label}
                      <ChevronDown className="h-4 w-4"/>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel
                      className="text-xs font-normal text-muted-foreground">目录始终在前</DropdownMenuLabel>
                    {SORT_OPTIONS.map(option => (
                      <DropdownMenuItem key={option.value} onSelect={() => setSortBy(option.value)}
                                        aria-label={option.label}
                        className={cn('justify-between', sortBy === option.value && 'bg-accent')}>
                        <span className="flex items-center gap-2">
                          {option.label}
                          {option.value === DEFAULT_SORT &&
                            <span aria-hidden="true" className="text-xs text-muted-foreground">默认</span>}
                        </span>
                        {sortBy === option.value && <Check className="h-4 w-4"/>}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem disabled={sortBy === DEFAULT_SORT} onSelect={() => setSortBy(DEFAULT_SORT)}>
                      <RotateCcw className="h-4 w-4"/> 恢复默认排序
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="file-viewport min-h-0 flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="py-14 text-center text-sm text-destructive">{error}</div>
            ) : loading ? (
              <AppLoading center/>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {folders.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'group relative flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 pr-10 transition-colors hover:border-primary',
                        selected.includes(item.id) && 'border-primary bg-accent',
                      )}
                      onClick={() => openFolder(item.path)}
                    >
                      {(() => {
                        const icon = fileIconMeta(item.name, 'folder')
                        return <icon.icon className={cn('h-8 w-8', icon.className)} />
                      })()}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {tree[item.path] === undefined ? '文件夹' : `${fileCount(item.path)} 个文件`}
                        </div>
                      </div>
                      {renderObjectMenu(item)}
                    </div>
                  ))}
                </div>

                {folders.length > 0 && files.length > 0 && <div className="my-4 border-t" />}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'group relative flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 pr-10 transition-colors hover:border-primary',
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
                        <div className="text-xs text-muted-foreground">
                          {formatSize(item.size)} · {(item.modifiedOn ?? '').slice(0, 10)}
                        </div>
                      </div>
                      {renderObjectMenu(item)}
                    </div>
                  ))}
                </div>

                {nodes.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">目录为空</div>}
              </>
            )}
          </div>
        </div>
      </div>

      <BizDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        title="新建目录"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFolderDialogOpen(false)} disabled={busy}>取消</Button>
            <Button onClick={handleCreateFolder} disabled={busy}>{busy ? '创建中…' : '创建'}</Button>
          </>
        }
      >
        <div className="space-y-2">
          <Input
            autoFocus
            value={folderName}
            placeholder="请输入目录名称"
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreateFolder()
            }}
          />
          {folderError && <p className="text-sm text-destructive">{folderError}</p>}
        </div>
      </BizDialog>

      <BizDialog
        open={editingNode !== null}
        onOpenChange={open => {
          if (!open && !busy) {
            ++editRequestRef.current
            setEditingNode(null)
          }
        }}
        title="编辑"
        width={480}
        footer={<>
          <Button variant="secondary" disabled={busy} onClick={() => { ++editRequestRef.current; setEditingNode(null) }}>取消</Button>
          <Button disabled={busy || !editReady} onClick={() => void handleEditNode()}>{busy ? '保存中…' : '保存'}</Button>
        </>}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm">名称
            <Input autoFocus value={editName} disabled={busy || editLoading}
              onChange={event => { setEditName(event.target.value); setEditError('') }}/>
          </label>

          {editingNode?.type === 'folder' && <div className="space-y-2">
            <p className="text-sm font-medium">可见成员</p>
            {editLoading ? <p className="text-sm text-muted-foreground">加载权限中…</p> :
              <DirectoryMemberPicker appId={appId} value={editMembers} onChange={setEditMembers} disabled={busy || !editReady}/>}
            <p className="text-xs text-muted-foreground">未选择成员时对所有应用用户可见。子目录同时受父目录限制，所有者和管理员始终可见。</p>
          </div>}
          {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
        </div>
      </BizDialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteTargets([])
        }}
        title="删除"
        message={
          <div className="space-y-2">
            <p>确定删除选中的 {deleteTargets.length} 项吗？此操作不可恢复。</p>
            {deleteError && <p className="text-destructive">{deleteError}</p>}
          </div>
        }
        busy={busy}
        confirmText="删除"
        onConfirm={() => void handleDelete()}
      />

      <BizDialog
        open={detailNode !== null}
        onOpenChange={(open) => {
          if (!open) setDetailNode(null)
        }}
        title="详情"
        width={480}
        footer={<Button variant="secondary" onClick={() => setDetailNode(null)}>关闭</Button>}
      >
        {detailNode && (
          <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-3">
            <dt className="text-muted-foreground">名称</dt>
            <dd className="break-all text-foreground">{detailNode.name}</dd>
            <dt className="text-muted-foreground">类型</dt>
            <dd className="text-foreground">{detailNode.type === 'folder' ? '文件夹' : '文件'}</dd>
            <dt className="text-muted-foreground">大小</dt>
            <dd className="text-foreground">
              {detailNode.type === 'folder'
                ? (tree[detailNode.path] === undefined ? '—' : `${fileCount(detailNode.path)} 个文件`)
                : formatSize(detailNode.size)}
            </dd>
            <dt className="text-muted-foreground">修改时间</dt>
            <dd className="text-foreground">{formatDateTime(detailNode.modifiedOn)}</dd>
            <dt className="text-muted-foreground">位置</dt>
            <dd className="break-all text-foreground">{breadcrumb.map((item) => item.name).join(' / ')}</dd>
          </dl>
        )}
      </BizDialog>

      <BizDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        title="移动文件"
        width={520}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveDialogOpen(false)} disabled={busy}>取消</Button>
            <Button onClick={handleMove} disabled={busy || !selectedNodes.length || moveDest === current}>
              {busy ? '移动中…' : '移动到此处'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-foreground">已选择 {selectedNodes.length} 项，请选择目标目录：</div>
          <div className="flex flex-wrap items-center gap-1">
            {moveBreadcrumb.map((item, index) => (
              <span key={item.id || index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#ccc]"/>}
                <button
                  type="button"
                  className={cn(
                    index === moveBreadcrumb.length - 1 ? 'text-foreground' : 'text-muted-foreground hover:text-primary',
                  )}
                  onClick={() => void loadMoveDir(item.id)}
                >
                  {item.name}
                </button>
              </span>
            ))}
          </div>
          <div className="max-h-[260px] min-h-[160px] overflow-y-auto rounded-md border">
            {moveLoading ? (
              <AppLoading center/>
            ) : moveNodes.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">当前目录下没有可选的子目录</div>
            ) : (
              moveNodes.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                  onClick={() => void loadMoveDir(folder.path)}
                >
                  <Folder className="h-4 w-4 text-[#fbbc05]"/>
                  <span className="min-w-0 flex-1 truncate text-foreground">{folder.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                </button>
              ))
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            目标：{moveBreadcrumb[moveBreadcrumb.length - 1]?.name}
            {moveDest === current && '（请选择其他目录）'}
          </div>
          {moveError && <p className="text-sm text-destructive">{moveError}</p>}
        </div>
      </BizDialog>
    </AppLayout>
  )
}
