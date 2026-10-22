import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 从异常中提取可展示的错误消息 */
export function toErrorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}

/** 多彩头像背景色池 */
const AVATAR_COLORS = ['#18181b', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7', '#f4f4f5']

export function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** 简单分页器 */
export function paginate<T>(list: T[], page: number, size: number) {
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(1, page), pages)
  return { rows: list.slice((p - 1) * size, p * size), total, pages, page: p, size }
}

/** 深度优先扁平化树（保留父节点在前） */
export function flattenTree<T extends { children?: T[] }>(nodes: T[]): T[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children ?? [])])
}

/** 在树中按 id 查找节点（深度优先） */
export function findInTree<T extends { id: string; children?: T[] }>(nodes: T[], id: string): T | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findInTree(node.children ?? [], id)
    if (child) return child
  }
  return undefined
}
