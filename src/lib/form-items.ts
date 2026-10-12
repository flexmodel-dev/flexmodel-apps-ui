export type FormItemWidthType =
  | 'QUARTER'
  | 'THIRD'
  | 'HALF'
  | 'TWO_THIRDS'
  | 'THREE_QUARTERS'
  | 'FULL'

export const formItemWidthOptions = [
  'QUARTER',
  'THIRD',
  'HALF',
  'TWO_THIRDS',
  'THREE_QUARTERS',
  'FULL',
] as const

export const formItemWidthTypeClasses: Record<FormItemWidthType, string> = {
  QUARTER: 'md:col-span-3',
  THIRD: 'md:col-span-4',
  HALF: 'md:col-span-6',
  TWO_THIRDS: 'md:col-span-8',
  THREE_QUARTERS: 'md:col-span-9',
  FULL: 'md:col-span-12',
}
