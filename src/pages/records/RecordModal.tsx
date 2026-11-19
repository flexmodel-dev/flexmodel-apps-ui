import {useSyncExternalStore, type ComponentProps} from 'react'
import {BizDrawer, type DrawerPresentation} from '@/components/ui/drawer'
import {FormMoreMenu} from '@/pages/records/FormMoreMenu'

const presentationStorageKey = 'flexmodel-apps.record-presentation'
const presentationListeners = new Set<() => void>()
let inMemoryPresentation: DrawerPresentation | undefined

function readPresentation(): DrawerPresentation {
  if (inMemoryPresentation) return inMemoryPresentation
  try {
    const stored = window.localStorage.getItem(presentationStorageKey)
    if (stored === 'drawer' || stored === 'fullscreen') return stored
  } catch {
    // 本地存储不可用时使用默认展示方式。
  }
  return 'dialog'
}

function subscribeToPresentation(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== presentationStorageKey && event.key !== null) return
    inMemoryPresentation = undefined
    listener()
  }
  presentationListeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    presentationListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function savePresentation(presentation: DrawerPresentation) {
  try {
    window.localStorage.setItem(presentationStorageKey, presentation)
    inMemoryPresentation = undefined
  } catch {
    inMemoryPresentation = presentation
  }
  presentationListeners.forEach(listener => listener())
}

export function RecordModal({onOpenDesign, onPrint, ...props}:
                              Omit<ComponentProps<typeof BizDrawer>, 'moreMenu' | 'presentation'>
                              & Pick<ComponentProps<typeof FormMoreMenu>, 'onOpenDesign' | 'onPrint'>
) {
  const presentation = useSyncExternalStore(subscribeToPresentation, readPresentation)

  return (
    <BizDrawer
      {...props}
      presentation={presentation}
      moreMenu={<FormMoreMenu
        onOpenDesign={onOpenDesign}
        onPrint={onPrint}
        presentation={{value: presentation, onChange: savePresentation}}
      />}
    />
  )
}
