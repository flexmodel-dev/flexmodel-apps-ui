import {describe, it, expect} from 'vitest'
import {fromDirectorySelections, toDirectorySelections, emptyControl} from './dataAuthorization'

describe('数据权限公共目录适配', () => {
  it('保留同ID不同实体类型及组织的包含子组织选项，并去重', () => {
    const groups = fromDirectorySelections([
      {type: 'USER', id: 'same'}, {type: 'ROLE', id: 'same'}, {type: 'USER', id: 'same'},
      {type: 'ORGANIZATION', id: 'parent', includeChildren: true}, {type: 'ORGANIZATION', id: 'other', includeChildren: false},
    ])
    expect(toDirectorySelections(groups)).toEqual([
      {type: 'USER', id: 'same'}, {type: 'ROLE', id: 'same'},
      {type: 'ORGANIZATION', id: 'parent', includeChildren: true}, {type: 'ORGANIZATION', id: 'other', includeChildren: false},
    ])
  })
  it('动态人员范围不变成静态选项，新关联子表默认无授权', () => {
    expect(toDirectorySelections([{type: 'SELF'}, {type: 'ALL_REPORTS'}])).toEqual([])
    expect(emptyControl('new_child')).toEqual({formName: 'new_child', readAll: false, writeAll: false, allowDelete: false, fieldControls: {}, condition: null})
  })
})
