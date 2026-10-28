import { Link } from 'react-router-dom'
import * as React from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {Empty} from '@/components/ui/empty'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {appIcons, type AppIconName} from '@/data/appIcons'
import {getApps} from '@/services/apps'
import { cn } from '@/lib/utils'

export function AppLauncher({ collapsed, currentAppId }: { collapsed?: boolean; currentAppId?: string }) {
  const [apps, setApps] = React.useState<Array<{
    id: string;
    name: string;
    description?: string;
    iconName: AppIconName
  }>>([])

  React.useEffect(() => {
    let cancelled = false
    getApps()
      .then((loadedApps) => !cancelled && setApps(loadedApps))
      .catch(() => !cancelled && setApps([]))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">应用启动器</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="h-8 justify-start gap-3 px-3 text-muted-foreground hover:text-primary">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'start' : 'start'}
        sideOffset={12}
        className="w-64"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">应用启动器</DropdownMenuLabel>
          <DropdownMenuItem asChild className="p-0 text-xs font-normal">
            <Link to="/admin/apps" className="text-primary">管理</Link>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto p-1">
          {apps.length === 0 && <Empty className="py-8" description="暂无应用"/>}
          {apps.map((app) => {
            const Icon = appIcons[app.iconName] ?? appIcons.Boxes
            const active = app.id === currentAppId
            return (
              <DropdownMenuItem key={app.id} asChild>
                <Link
                  to={`/apps/${app.id}`}
                  className={cn(
                    'flex items-start gap-3 rounded-md p-2',
                    active && 'bg-primary/10 text-primary',
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{app.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{app.description}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
