import {navIcons, type NavIconName, type NavItem, type TopNavItem} from '@/data/mock'
import type {AppMenu, AppMenuOrderInput} from '@/services/appMenus'

export function menuIcon(iconName?: string | null) {
  return iconName && iconName !== 'none' ? navIcons[iconName as NavIconName] : undefined
}

function findFirstPageRoute(menu: AppMenu): string | undefined {
  if (menu.type === 'ITEM') return menu.pageRoute ?? undefined
  for (const child of menu.children) {
    const pageRoute = findFirstPageRoute(child)
    if (pageRoute) return pageRoute
  }
  return undefined
}

export function findFirstItemRoute(menus: AppMenu[]): string | undefined {
  for (const menu of menus) {
    const pageRoute = findFirstPageRoute(menu)
    if (pageRoute) return pageRoute
  }
  return undefined
}

export function findFirstItemRouteInMenu(menu: AppMenu): string | undefined {
  return findFirstPageRoute(menu)
}

function containsMenu(menu: AppMenu, menuId: string): boolean {
  return menu.id === menuId || menu.children.some((child) => containsMenu(child, menuId))
}

export function findMenuById(menus: AppMenu[], menuId: string): AppMenu | undefined {
  for (const menu of menus) {
    if (menu.id === menuId) return menu
    const child = findMenuById(menu.children, menuId)
    if (child) return child
  }
  return undefined
}

export function findTopMenuIdForMenu(menus: AppMenu[], menuId?: string): string | undefined {
  if (!menuId) return undefined
  return menus.find((menu) => containsMenu(menu, menuId))?.id
}

export function findFormMenuTargets(menus: AppMenu[]): Array<{ id: string; label: string }> {
  const targets = new Map<string, string>()
  const collect = (menu: AppMenu) => {
    if (menu.target?.type === 'FORM') {
      targets.set(menu.target.id, menu.target.label ?? menu.target.id)
    }
    menu.children.forEach(collect)
  }
  menus.forEach(collect)
  return [...targets].map(([id, label]) => ({id, label}))
}

export function toNavigationItem(menu: AppMenu, appId: string): NavItem {
  return {
    id: menu.id,
    icon: menuIcon(menu.iconName),
    text: menu.name,
    to: menu.type === 'ITEM' ? (menu.pageRoute ?? `/apps/${appId}/${menu.id}`) : undefined,
    sub: menu.type === 'GROUP' ? menu.children.map((child) => toNavigationItem(child, appId)) : undefined,
  }
}

export function toTopNavigationItem(menu: AppMenu, appId: string): TopNavItem {
  return {
    id: menu.id,
    text: menu.name,
    to: findFirstPageRoute(menu) ?? `/apps/${appId}?top=${encodeURIComponent(menu.id)}`,
    navs: menu.children.map((child) => toNavigationItem(child, appId)),
  }
}

function collectChildrenOrder(menus: AppMenu[], order: Record<string, string[]>) {
  menus.forEach((menu) => {
    if (menu.type === 'GROUP') {
      order[menu.id] = menu.children.map((child) => child.id)
      collectChildrenOrder(menu.children, order)
    }
  })
}

export function menuOrderInput(menus: AppMenu[]): AppMenuOrderInput {
  const children: Record<string, string[]> = {}
  collectChildrenOrder(menus, children)
  return {root: menus.map((menu) => menu.id), children}
}

export function moveMenuNode(
  menus: AppMenu[],
  menuId: string,
  targetParentId: string,
  targetIndex: number,
): AppMenu[] {
  const movedMenu = menus.flatMap((menu) => flattenMenus(menu)).find((menu) => menu.id === menuId)
  if (!movedMenu) return menus

  const remainingMenus = removeMenuNode(menus, menuId)
  return insertMenuNode(remainingMenus, movedMenu, targetParentId, targetIndex)
}

function flattenMenus(menu: AppMenu): AppMenu[] {
  return [menu, ...menu.children.flatMap(flattenMenus)]
}

function removeMenuNode(menus: AppMenu[], menuId: string): AppMenu[] {
  return menus
    .filter((menu) => menu.id !== menuId)
    .map((menu) => ({...menu, children: removeMenuNode(menu.children, menuId)}))
}

function insertMenuNode(
  menus: AppMenu[],
  movedMenu: AppMenu,
  targetParentId: string,
  targetIndex: number,
): AppMenu[] {
  return menus.map((menu) => {
    if (menu.id === targetParentId) {
      const index = Math.max(0, Math.min(targetIndex, menu.children.length))
      return {
        ...menu,
        children: [
          ...menu.children.slice(0, index),
          {...movedMenu, parentId: targetParentId},
          ...menu.children.slice(index),
        ],
      }
    }
    return {...menu, children: insertMenuNode(menu.children, movedMenu, targetParentId, targetIndex)}
  })
}

export function reorderMenuChildren(
  menus: AppMenu[],
  parentId: string,
  orderedChildIds: string[],
): AppMenu[] {
  return menus.map((menu) => {
    if (menu.id === parentId) {
      const childrenById = new Map(menu.children.map((child) => [child.id, child]))
      return {
        ...menu,
        children: orderedChildIds
          .map((id) => childrenById.get(id))
          .filter((child): child is AppMenu => Boolean(child)),
      }
    }
    if (menu.children.length === 0) return menu
    return {...menu, children: reorderMenuChildren(menu.children, parentId, orderedChildIds)}
  })
}
