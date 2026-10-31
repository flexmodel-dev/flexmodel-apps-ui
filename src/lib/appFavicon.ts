import * as React from 'react'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {appIcons, resolveAppIconName} from '@/data/appIcons'
import {getAppPrimaryColor} from '@/theme/appPrimaryColors'

const FALLBACK_FAVICON = '/favicon.png'

let defaultIcon: { href: string; type: string | null } | null = null

function findFaviconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
}

function applyFavicon(href: string, type: string | null) {
  const link = findFaviconLink()
  if (!link) return
  if (!defaultIcon) {
    defaultIcon = {href: link.getAttribute('href') ?? FALLBACK_FAVICON, type: link.getAttribute('type')}
  }
  link.setAttribute('href', href)
  if (type) link.setAttribute('type', type)
  else link.removeAttribute('type')
}

function restoreFavicon() {
  const link = findFaviconLink()
  if (!link || !defaultIcon) return
  link.setAttribute('href', defaultIcon.href)
  if (defaultIcon.type) link.setAttribute('type', defaultIcon.type)
  else link.removeAttribute('type')
}

function hslTriplet(value: string): string {
  return `hsl(${value.split(' ').join(', ')})`
}

function buildAppFavicon(iconName: string, primaryColor?: string | null): string {
  const Icon = appIcons[resolveAppIconName(iconName)]
  const svg = renderToStaticMarkup(
    createElement(Icon, {color: hslTriplet(getAppPrimaryColor(primaryColor).primary)}),
  )
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** 进入应用时把浏览器标签图标切换为该应用的图标与主色，离开后恢复默认图标。 */
export function useAppFavicon(app?: { iconName?: string | null; primaryColor?: string | null } | null) {
  const iconName = app ? resolveAppIconName(app.iconName) : null
  const primaryColor = app?.primaryColor ?? null

  React.useEffect(() => {
    if (!iconName) {
      restoreFavicon()
      return
    }
    applyFavicon(buildAppFavicon(iconName, primaryColor), 'image/svg+xml')
    return () => restoreFavicon()
  }, [iconName, primaryColor])
}
