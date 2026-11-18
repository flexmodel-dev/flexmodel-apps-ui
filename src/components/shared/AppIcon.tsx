import {appIcons, type AppIconName} from '@/data/appIcons'
import {getAppPrimaryColor, type AppPrimaryColor} from '@/theme/appPrimaryColors'

export function AppIcon({iconName, primaryColor}: { iconName: AppIconName; primaryColor: AppPrimaryColor }) {
  const Icon = appIcons[iconName] ?? appIcons.Boxes
  return <span data-primary={getAppPrimaryColor(primaryColor).value}
               className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform duration-150 group-hover:scale-105">
    <Icon className="h-8 w-8"/>
  </span>
}
