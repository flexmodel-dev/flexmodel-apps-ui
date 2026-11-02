import type {FilterCondition} from '@/services/appForms'

function isEmpty(value: unknown) {
  return value == null || value === '' || Array.isArray(value) && value.length === 0
}

function equals(left: unknown, right: unknown): boolean {
  if (isEmpty(left) && isEmpty(right)) return true
  if (left == null || right == null) return false
  if (typeof left === 'boolean' || typeof right === 'boolean') return left === right
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber
  }
  return String(left) === String(right)
}

/** 数字与 ISO 日期/时间字符串按值比较；其余文本按字面顺序比较。 */
function compare(left: unknown, right: unknown): number | null {
  if (isEmpty(left) || isEmpty(right)) return null
  const leftNumber = typeof left === 'number' ? left : Number(left)
  const rightNumber = typeof right === 'number' ? right : Number(right)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber
  const leftText = String(left)
  const rightText = String(right)
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0
}

function contains(actual: unknown, expected: unknown) {
  if (Array.isArray(actual)) return actual.some(item => equals(item, expected))
  return !isEmpty(actual) && String(actual).includes(String(expected ?? ''))
}

function matchOperator(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case '_eq':
      return equals(actual, expected)
    case '_ne':
      return !equals(actual, expected)
    case '_contains':
      return contains(actual, expected)
    case '_not_contains':
      return !contains(actual, expected)
    case '_starts_with':
      return !isEmpty(actual) && String(actual).startsWith(String(expected ?? ''))
    case '_ends_with':
      return !isEmpty(actual) && String(actual).endsWith(String(expected ?? ''))
    case '_gt':
      return (compare(actual, expected) ?? 0) > 0
    case '_gte':
      return (compare(actual, expected) ?? -1) >= 0
    case '_lt':
      return (compare(actual, expected) ?? 0) < 0
    case '_lte':
      return (compare(actual, expected) ?? 1) <= 0
    case '_in':
      return Array.isArray(expected)
        && (Array.isArray(actual)
          ? actual.some(item => expected.some(candidate => equals(item, candidate)))
          : expected.some(candidate => equals(actual, candidate)))
    case '_nin':
      return !matchOperator(actual, '_in', expected)
    case '_between': {
      if (!Array.isArray(expected) || expected.length !== 2) return false
      const lower = compare(actual, expected[0])
      const upper = compare(actual, expected[1])
      return lower != null && upper != null && lower >= 0 && upper <= 0
    }
    default:
      return false
  }
}

/** 按记录查询 filter DSL 求值：同层隐式 AND、快捷等值、_and/_or、null 为空值。 */
export function matchesFilterCondition(condition: FilterCondition | null | undefined,
                                       values: Record<string, unknown>): boolean {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return false
  const entries = Object.entries(condition)
  if (!entries.length) return false
  return entries.every(([key, node]) => {
    if (key === '_and') {
      return Array.isArray(node) && node.length > 0
        && node.every(child => matchesFilterCondition(child as FilterCondition, values))
    }
    if (key === '_or') {
      return Array.isArray(node) && node.some(child => matchesFilterCondition(child as FilterCondition, values))
    }
    if (key.startsWith('_')) return false
    const actual = values[key]
    if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
      const operators = Object.entries(node as Record<string, unknown>)
      return operators.length > 0 && operators.every(([operator, operand]) =>
        matchOperator(actual, operator, operand))
    }
    return equals(actual, node)
  })
}
