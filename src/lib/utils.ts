import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 生成 16 进制 ID，如 001-1234567890123456 */
export function genId(prefix = '001') {
  return `${prefix}-${String(Date.now())}${Math.floor(Math.random() * 900 + 100)}`
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
