import * as React from 'react'
import {CircleHelp, Filter} from 'lucide-react'
import {Checkbox} from '@/components/ui/checkbox'
import {Button} from '@/components/ui/button'
import {BizDialog} from '@/components/ui/dialog'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {FilterConditionEditor} from '@/components/biz/FilterConditionEditor'
import type {
  AppFormControl,
  AppFormControls,
  AppFormField,
  AppFormScene,
  FilterCondition,
} from '@/services/appForms'
import {cn} from '@/lib/utils'

type ControlKey = 'hidden' | 'required' | 'readonly'

const scenes: Array<{ value: AppFormScene; label: string }> = [
  {value: 'CREATE', label: '新建时'},
  {value: 'UPDATE', label: '编辑时'},
]

const properties: Array<{ key: ControlKey; label: string; help: string }> = [
  {key: 'hidden', label: '隐藏', help: '勾选场景后隐藏字段；设置条件后仅在条件满足时隐藏。'},
  {key: 'required', label: '必填', help: '勾选场景后要求填写字段；设置条件后仅在条件满足时必填。字段默认必填始终生效。'},
  {key: 'readonly', label: '只读', help: '勾选场景后字段不可编辑；设置条件后仅在条件满足时只读。'},
]

export function FormAdvancedControls({rows, controls, onChange}: {
  rows: Array<{ field: AppFormField; label: string }>
  controls: AppFormControls
  onChange: (controls: AppFormControls) => void
}) {
  const [editing, setEditing] = React.useState<{
    fieldName: string
    property: ControlKey
    condition: FilterCondition | null
  } | null>(null)

  const updateControl = (fieldName: string, property: ControlKey,
                         update: (control: AppFormControl | undefined) => AppFormControl | undefined) => {
    const fieldControls = controls[fieldName] ?? {}
    const nextControl = update(fieldControls[property])
    const nextFieldControls = {...fieldControls, [property]: nextControl}
    if (!nextFieldControls.hidden && !nextFieldControls.required && !nextFieldControls.readonly) {
      const {[fieldName]: _removed, ...rest} = controls
      onChange(rest)
      return
    }
    onChange({...controls, [fieldName]: nextFieldControls})
  }

  const toggleScene = (fieldName: string, property: ControlKey, scene: AppFormScene, checked: boolean) => {
    updateControl(fieldName, property, control => {
      const selected = new Set(control?.scenes ?? [])
      if (checked) selected.add(scene)
      else selected.delete(scene)
      const nextScenes = scenes.map(item => item.value).filter(value => selected.has(value))
      return nextScenes.length ? {...control, scenes: nextScenes} : undefined
    })
  }

  const openCondition = (fieldName: string, property: ControlKey) => {
    setEditing({
      fieldName,
      property,
      condition: controls[fieldName]?.[property]?.condition ?? null,
    })
  }

  const applyCondition = () => {
    if (!editing) return
    updateControl(editing.fieldName, editing.property, control => {
      if (!editing.condition) {
        return control?.scenes?.length ? {scenes: control.scenes} : undefined
      }
      return {
        scenes: control?.scenes?.length ? control.scenes : scenes.map(item => item.value),
        condition: editing.condition,
      }
    })
    setEditing(null)
  }

  const editingRow = editing ? rows.find(row => row.field.name === editing.fieldName) : undefined
  const editingProperty = editing ? properties.find(property => property.key === editing.property) : undefined

  return <>
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <table className="app-table w-full min-w-[900px]">
        <thead>
        <tr>
          <th className="sticky top-0 z-10">字段</th>
          {properties.map(property => (
            <th key={property.key} className="sticky top-0 z-10 w-[240px]">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1">
                      {property.label}
                      <CircleHelp className="h-3.5 w-3.5 text-muted-foreground"/>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{property.help}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </th>
          ))}
        </tr>
        </thead>
        <tbody>
        {rows.map(row => {
          const fieldControls = controls[row.field.name] ?? {}
          return <tr key={row.field.name}>
            <td className="whitespace-nowrap">
              <span className="font-medium">{row.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{row.field.name}</span>
              {row.field.builtin && (
                <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">内置</span>
              )}
            </td>
            {properties.map(property => {
              const control = fieldControls[property.key]
              const builtin = row.field.builtin
              const requiredLocked = property.key === 'required' && row.field.required
              const checkedFor = (scene: AppFormScene) => builtin
                ? property.key === 'readonly' || (property.key === 'required' && row.field.required)
                : requiredLocked || Boolean(control?.scenes?.includes(scene))
              return <td key={property.key}>
                <div className="flex items-center gap-3">
                  {scenes.map(scene => (
                    <label
                      key={scene.value}
                      className={cn('flex items-center gap-1.5 text-sm', (builtin || requiredLocked) && 'text-muted-foreground')}
                    >
                      <Checkbox
                        checked={checkedFor(scene.value)}
                        disabled={builtin || requiredLocked}
                        className={cn((builtin || requiredLocked) && 'cursor-not-allowed opacity-50')}
                        onCheckedChange={checked => toggleScene(row.field.name, property.key, scene.value, checked === true)}
                      />
                      {scene.label}
                    </label>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7 shrink-0', !builtin && control?.condition ? 'text-primary' : 'text-muted-foreground')}
                    title={builtin ? '内置字段不可修改字段控制' : control?.condition ? `修改${property.label}条件` : `设置${property.label}条件`}
                    disabled={builtin || requiredLocked}
                    onClick={() => openCondition(row.field.name, property.key)}
                  >
                    <Filter className="h-4 w-4"/>
                  </Button>
                </div>
              </td>
            })}
          </tr>
        })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="px-3 py-10 text-center text-sm text-muted-foreground">暂无可控制字段</div>
      )}
    </div>
    <p className="px-3 py-2 text-xs text-muted-foreground">
      未勾选任何场景的控制不生效；详情页沿用编辑时配置，并按查看状态整体只读。内置字段始终展示且只读，不可配置控制。
    </p>

    <BizDialog
      open={Boolean(editing)}
      onOpenChange={open => !open && setEditing(null)}
      width={640}
      title={editingProperty && editingRow ? `${editingProperty.label}条件 · ${editingRow.label}` : '字段条件'}
      footer={<>
        <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button>
        <Button onClick={applyCondition}>确定</Button>
      </>}
    >
      {editing && <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          不设置条件时，在所选场景下始终生效；设置条件后，仅在条件满足时生效。未勾选场景时默认应用于新建和编辑。
        </p>
        <FilterConditionEditor
          fields={rows.map(row => row.field)}
          value={editing.condition}
          onChange={condition => setEditing(previous => previous ? {...previous, condition} : previous)}
        />
      </div>}
    </BizDialog>
  </>
}
