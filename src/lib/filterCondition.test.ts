import {describe, expect, it} from 'vitest'
import {matchesFilterCondition} from './filterCondition'

describe('matchesFilterCondition', () => {
  it('supports shortcut equality and implicit AND', () => {
    expect(matchesFilterCondition({status: 'REJECTED'}, {status: 'REJECTED'})).toBe(true)
    expect(matchesFilterCondition({status: 'REJECTED', owner: 'u1'}, {status: 'REJECTED'})).toBe(false)
    expect(matchesFilterCondition({status: 'REJECTED', owner: 'u1'}, {status: 'REJECTED', owner: 'u1'})).toBe(true)
  })

  it('treats null as empty value', () => {
    expect(matchesFilterCondition({remark: {_eq: null}}, {remark: ''})).toBe(true)
    expect(matchesFilterCondition({remark: {_ne: null}}, {remark: '有值'})).toBe(true)
    expect(matchesFilterCondition({remark: {_ne: null}}, {})).toBe(false)
  })

  it('supports _and and _or groups', () => {
    const condition = {
      _or: [
        {status: {_eq: 'REJECTED'}},
        {_and: [{amount: {_gte: 100}}, {approved: {_eq: false}}]},
      ],
    }
    expect(matchesFilterCondition(condition, {status: 'DRAFT', amount: 120, approved: false})).toBe(true)
    expect(matchesFilterCondition(condition, {status: 'DRAFT', amount: 80, approved: false})).toBe(false)
  })

  it('compares numbers, dates and booleans', () => {
    expect(matchesFilterCondition({amount: {_gt: 50}}, {amount: 100})).toBe(true)
    expect(matchesFilterCondition({amount: {_gt: 50}}, {amount: '100'})).toBe(true)
    expect(matchesFilterCondition({due: {_lt: '2026-02-01'}}, {due: '2026-01-15'})).toBe(true)
    expect(matchesFilterCondition({approved: {_eq: false}}, {approved: false})).toBe(true)
    expect(matchesFilterCondition({approved: {_eq: false}}, {approved: ''})).toBe(false)
  })

  it('supports contains, in, nin and between', () => {
    expect(matchesFilterCondition({title: {_contains: '合同'}}, {title: '采购合同'})).toBe(true)
    expect(matchesFilterCondition({tags: {_contains: 'A'}}, {tags: ['B', 'A']})).toBe(true)
    expect(matchesFilterCondition({status: {_in: ['DRAFT', 'REJECTED']}}, {status: 'DRAFT'})).toBe(true)
    expect(matchesFilterCondition({status: {_nin: ['DRAFT']}}, {status: 'DRAFT'})).toBe(false)
    expect(matchesFilterCondition({amount: {_between: [10, 20]}}, {amount: 15})).toBe(true)
    expect(matchesFilterCondition({amount: {_between: [10, 20]}}, {amount: 21})).toBe(false)
  })

  it('never matches empty or unsupported conditions', () => {
    expect(matchesFilterCondition({}, {status: 'DRAFT'})).toBe(false)
    expect(matchesFilterCondition({status: {_unknown: 'DRAFT'}}, {status: 'DRAFT'})).toBe(false)
    expect(matchesFilterCondition(null, {status: 'DRAFT'})).toBe(false)
  })
})
