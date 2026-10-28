/**
 * 应用主色唯一数据源：新增主色只需在本文件追加一项。
 * CSS 变量、色板圆点与应用卡片着色均由这里派生。
 */

export interface AppPrimaryColorEntry {
  value: string
  label: string
  /** 浅色模式 --primary / --ring / --secondary-foreground */
  primary: string
  /** 浅色模式 --accent-foreground */
  accent: string
  /** 夜间模式以上四项统一使用 */
  primaryDark: string
  /** 可选：浅色模式 --primary-foreground 覆盖（亮色主色需要深色文字） */
  foreground?: string
}

export const APP_PRIMARY_COLORS = [
  {value: 'blue', label: '蓝色', primary: '217 91% 60%', accent: '217 91% 46%', primaryDark: '217 91% 70%'},
  {value: 'sky', label: '天蓝', primary: '200 98% 39%', accent: '201 90% 32%', primaryDark: '198 93% 60%'},
  {value: 'cyan', label: '青色', primary: '192 91% 36%', accent: '193 82% 28%', primaryDark: '188 86% 53%'},
  {value: 'teal', label: '蓝绿', primary: '175 84% 32%', accent: '175 77% 25%', primaryDark: '172 66% 50%'},
  {value: 'green', label: '绿色', primary: '160 84% 39%', accent: '160 84% 32%', primaryDark: '160 84% 60%'},
  {value: 'lime', label: '柠绿', primary: '85 78% 27%', accent: '84 81% 20%', primaryDark: '82 85% 55%'},
  {
    value: 'yellow',
    label: '黄色',
    primary: '41 96% 40%',
    accent: '41 96% 32%',
    primaryDark: '48 96% 53%',
    foreground: '224 40% 10%',
  },
  {value: 'amber', label: '琥珀', primary: '38 92% 50%', accent: '38 92% 40%', primaryDark: '38 92% 65%'},
  {value: 'orange', label: '橙色', primary: '21 90% 48%', accent: '17 88% 39%', primaryDark: '27 96% 61%'},
  {value: 'red', label: '红色', primary: '0 72% 51%', accent: '0 72% 42%', primaryDark: '0 91% 71%'},
  {value: 'rose', label: '玫红', primary: '350 89% 60%', accent: '350 89% 46%', primaryDark: '350 89% 70%'},
  {value: 'pink', label: '粉色', primary: '333 71% 51%', accent: '333 71% 42%', primaryDark: '329 86% 70%'},
  {value: 'fuchsia', label: '洋红', primary: '293 69% 49%', accent: '293 69% 40%', primaryDark: '292 91% 73%'},
  {value: 'purple', label: '紫色', primary: '272 72% 56%', accent: '272 72% 46%', primaryDark: '270 95% 75%'},
  {value: 'violet', label: '紫罗兰', primary: '262 83% 58%', accent: '262 83% 48%', primaryDark: '255 92% 76%'},
  {value: 'indigo', label: '靛蓝', primary: '243 75% 59%', accent: '243 75% 46%', primaryDark: '243 75% 66%'},
  {value: 'gray', label: '灰色', primary: '220 9% 46%', accent: '220 9% 36%', primaryDark: '218 11% 65%'},
  {value: 'black', label: '黑色', primary: '0 0% 9%', accent: '0 0% 9%', primaryDark: '0 0% 98%'},
] as const satisfies readonly AppPrimaryColorEntry[]

export type AppPrimaryColor = (typeof APP_PRIMARY_COLORS)[number]['value']
export type AppPrimaryColorDefinition = (typeof APP_PRIMARY_COLORS)[number] & { swatch: string }

export const DEFAULT_APP_PRIMARY_COLOR: AppPrimaryColor = 'blue'

const entryMap = new Map<AppPrimaryColor, (typeof APP_PRIMARY_COLORS)[number]>(
  APP_PRIMARY_COLORS.map((entry) => [entry.value, entry] as const),
)

export function getAppPrimaryColor(value?: string | null): AppPrimaryColorDefinition {
  const entry = (value ? entryMap.get(value as AppPrimaryColor) : undefined)
    ?? entryMap.get(DEFAULT_APP_PRIMARY_COLOR)!
  return {...entry, swatch: `hsl(${entry.primary})`}
}

export function applyAppPrimaryColor(value?: string | null): void {
  document.documentElement.dataset.primary = getAppPrimaryColor(value).value
}

function declarations(entry: AppPrimaryColorEntry, dark: boolean): string {
  const primary = dark ? entry.primaryDark : entry.primary
  const parts = [
    `--primary:${primary}`,
    `--ring:${primary}`,
    `--secondary-foreground:${primary}`,
    `--accent-foreground:${dark ? entry.primaryDark : entry.accent}`,
  ]
  if (!dark && entry.foreground) {
    parts.push(`--primary-foreground:${entry.foreground}`)
  }
  return parts.join(';')
}

export function buildAppPrimaryColorCss(): string {
  return APP_PRIMARY_COLORS.map((entry) => [
    `[data-primary='${entry.value}']{${declarations(entry, false)}}`,
    `.dark [data-primary='${entry.value}'],.dark[data-primary='${entry.value}']{${declarations(entry, true)}}`,
  ].join('')).join('')
}

const STYLE_ELEMENT_ID = 'app-primary-theme'

export function installAppPrimaryColorStyles(): void {
  if (typeof document === 'undefined') return
  const css = buildAppPrimaryColorCss()
  const existing = document.getElementById(STYLE_ELEMENT_ID)
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = css
  document.head.appendChild(style)
}

installAppPrimaryColorStyles()
