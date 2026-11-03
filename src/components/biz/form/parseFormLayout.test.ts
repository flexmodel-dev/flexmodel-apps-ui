import {describe, expect, it} from 'vitest'
import {groupFormLayoutFields, parseFormLayout} from './parseFormLayout'
import type {AppForm, AppFormControls} from '@/services/appForms'

function form(controls?: AppFormControls, required = false, builtin = false): AppForm {
  return {
    name: 'f_order',
    label: '订单',
    description: '',
    managed: true,
    builtin: false,
    fields: [
      {name: 'status', label: '状态', type: 'TEXT', required, builtin: false},
      {name: 'amount', label: '金额', type: 'DECIMAL', required: false, builtin},
    ],
    layout: {
      items: [
        {type: 'FIELD', name: 'status'},
        {type: 'FIELD', name: 'amount'},
      ],
      controls,
    },
    viewTabs: [],
  }
}

describe('groupFormLayoutFields', () => {
  it('groups fields under each section and keeps leading fields ungrouped', () => {
    const parsed = parseFormLayout({
      ...form(),
      layout: {
        items: [
          {type: 'FIELD', name: 'status'},
          {type: 'SECTION', label: '金额信息'},
          {type: 'FIELD', name: 'amount'},
        ],
      },
    }, {scene: 'CREATE', values: {}})
    expect(groupFormLayoutFields(parsed.entries).map(group => ({
      label: group.section?.label ?? null,
      fields: group.fields.map(entry => entry.field.name),
    }))).toEqual([
      {label: null, fields: ['status']},
      {label: '金额信息', fields: ['amount']},
    ])
  })

  it('keeps an empty section group so its title still renders', () => {
    const parsed = parseFormLayout({
      ...form(),
      layout: {
        items: [
          {type: 'FIELD', name: 'status'},
          {type: 'SECTION', label: '空分栏'},
        ],
      },
    }, {scene: 'CREATE', values: {}})
    const groups = groupFormLayoutFields(parsed.entries)
    expect(groups).toHaveLength(2)
    expect(groups[1]).toMatchObject({section: {label: '空分栏'}, fields: []})
  })
})

describe('parseFormLayout controls', () => {
  it('keeps defaults without controls', () => {
    const parsed = parseFormLayout(form(), {scene: 'CREATE', values: {}})
    expect(parsed.entries.map(entry => entry.kind)).toEqual(['FIELD', 'FIELD'])
    expect(parsed.requiredFieldNames.size).toBe(0)
    expect(parsed.entries[0].kind === 'FIELD' && parsed.entries[0].readonly).toBe(false)
  })

  it('applies hidden only in matching scenes and when the condition matches', () => {
    const controls: AppFormControls = {
      amount: {hidden: {scenes: ['CREATE'], condition: {status: {_eq: 'REJECTED'}}}},
    }
    expect(parseFormLayout(form(controls), {scene: 'CREATE', values: {status: 'REJECTED'}})
      .entries.map(entry => entry.kind === 'FIELD' && entry.field.name)).toEqual(['status'])
    expect(parseFormLayout(form(controls), {scene: 'CREATE', values: {status: 'DRAFT'}})
      .entries.map(entry => entry.kind === 'FIELD' && entry.field.name)).toEqual(['status', 'amount'])
    expect(parseFormLayout(form(controls), {scene: 'UPDATE', values: {status: 'REJECTED'}})
      .entries.map(entry => entry.kind === 'FIELD' && entry.field.name)).toEqual(['status', 'amount'])
  })

  it('requires and locks fields when their controls are active', () => {
    const controls: AppFormControls = {
      amount: {
        required: {scenes: ['CREATE', 'UPDATE'], condition: {status: {_eq: 'APPROVED'}}},
        readonly: {scenes: ['UPDATE']},
      },
    }
    const create = parseFormLayout(form(controls), {scene: 'CREATE', values: {status: 'APPROVED'}})
    expect(create.requiredFieldNames.has('amount')).toBe(true)
    expect(create.entries.find(entry => entry.kind === 'FIELD' && entry.field.name === 'amount'))
      .toMatchObject({required: true, readonly: false})
    const update = parseFormLayout(form(controls), {scene: 'UPDATE', values: {status: 'APPROVED'}})
    expect(update.requiredFieldNames.has('amount')).toBe(false)
    expect(update.entries.find(entry => entry.kind === 'FIELD' && entry.field.name === 'amount'))
      .toMatchObject({required: true, readonly: true})
  })

  it('never relaxes the field default required setting', () => {
    const controls: AppFormControls = {status: {required: {scenes: ['CREATE']}}}
    expect(parseFormLayout(form(controls, true), {scene: 'UPDATE', values: {}})
      .requiredFieldNames.has('status')).toBe(true)
  })

  it('keeps builtin fields visible and readonly regardless of controls', () => {
    const controls: AppFormControls = {
      amount: {
        hidden: {scenes: ['CREATE', 'UPDATE']},
        readonly: {scenes: []},
      },
    }
    const parsed = parseFormLayout(form(controls, false, true), {scene: 'CREATE', values: {}})
    expect(parsed.renderableFieldNames.has('amount')).toBe(true)
    expect(parsed.entries.find(entry => entry.kind === 'FIELD' && entry.field.name === 'amount'))
      .toMatchObject({readonly: true, required: false})
  })
})
