import * as React from 'react'

function readDarkMode(): boolean {
  try {
    const stored = window.localStorage.getItem('night')
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    // 本地存储不可用时跟随系统。
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyDarkMode(isDark: boolean): void {
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

/** 首屏（包括应用加载态）绘制前恢复明暗模式。 */
export function initializeDarkMode(): void {
  applyDarkMode(readDarkMode())
}

/** 夜间模式开关：localStorage('night') 持久化，未设置时跟随系统偏好 */
export function useDarkMode(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [isDark, setIsDark] = React.useState(readDarkMode)

  React.useLayoutEffect(() => {
    applyDarkMode(isDark)
    try {
      window.localStorage.setItem('night', String(isDark))
    } catch {
      // 仍允许在当前页面切换明暗模式。
    }
  }, [isDark])

  return [isDark, setIsDark]
}
