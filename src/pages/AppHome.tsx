import * as React from 'react'
import {useParams} from 'react-router-dom'
import {AppLayout} from '@/components/layout/AppLayout'
import {MenuEditorDialog} from '@/components/layout/MenuEditorDialog'
import {topNavs} from '@/data/mock'
import {Plus} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'

export default function AppHome() {
  const {appId = ''} = useParams<{ appId: string }>()
  const [menuEditorOpen, setMenuEditorOpen] = React.useState(false)
  const [activeTopId, setActiveTopId] = React.useState(topNavs[0]?.id ?? '')

  return (
    <AppLayout>
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <Empty
          className="w-full max-w-md rounded-2xl border-border/70"
          description={<span className="text-base">当前分组没有关联菜单</span>}
        >
          <Button
            type="button"
            className="h-10 w-full justify-center rounded-xl"
            onClick={() => setMenuEditorOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4"/> 新增菜单
          </Button>
        </Empty>
      </div>
      <MenuEditorDialog
        open={menuEditorOpen}
        onOpenChange={setMenuEditorOpen}
        activeTopId={activeTopId}
        onActiveTopIdChange={setActiveTopId}
        onMenusChange={() => {
        }}
      />
    </AppLayout>
  )
}
