import * as React from 'react'

/** 夜间模式开关：localStorage('night') 持久化，未设置时跟随系统偏好 */
export function useDarkMode(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [isDark, setIsDark] = React.useState(() => {
    const stored = window.localStorage.getItem('night')
    if (stored === 'true' || stored === 'false') return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
    window.localStorage.setItem('night', String(isDark))
  }, [isDark])

  return [isDark, setIsDark]
}
