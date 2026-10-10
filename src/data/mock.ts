import {
  Banknote,
  BookUser,
  Boxes,
  ClipboardCheck,
  Folder,
  Home,
  PieChart,
  Shapes,
  ShoppingCart,
  Settings,
  Tags,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react'

/**
 * 假数据层
 * 模拟业务对象（客户/商机/...）、记录、用户、部门等
 */

export interface User {
  id: string
  name: string
  fullName: string
  email: string
  dept: string
  role: string
  active: boolean
  workphone?: string
  teams?: string[]
}

export interface Department {
  id: string
  name: string
  parent: string | null
}

export interface BusinessObjectField {
  name: string
  label: string
  type: string
  options?: { id: string; text: string; color?: string; 'default'?: boolean }[]
  refBusinessObject?: string
}

export interface BusinessObjectMeta {
  name: string
  label: string
  icon: LucideIcon
  displayField: string
  detail?: { name: string; label: string; icon: string }[]
  fields: BusinessObjectField[]
  description?: string
  badge?: string
}

export interface RbRecord {
  id: string
  [key: string]: unknown
}

export const appIconOptions = [
  'ShoppingCart',
  'Banknote',
  'Boxes',
  'Folder',
  'Tags',
  'TrendingUp',
] as const

export type AppIconName = (typeof appIconOptions)[number]

export const appIcons: Record<AppIconName, LucideIcon> = {
  ShoppingCart,
  Banknote,
  Boxes,
  Folder,
  Tags,
  TrendingUp,
}

export type AppPrimaryColor = 'indigo' | 'blue' | 'green' | 'amber' | 'rose' | 'black'

export const appPrimaryColors: Array<{
  value: AppPrimaryColor
  label: string
  swatch: string
}> = [
  {value: 'indigo', label: '靛蓝', swatch: 'hsl(243 75% 59%)'},
  {value: 'blue', label: '蓝色', swatch: 'hsl(217 91% 60%)'},
  {value: 'green', label: '绿色', swatch: 'hsl(160 84% 39%)'},
  {value: 'amber', label: '橙色', swatch: 'hsl(38 92% 50%)'},
  {value: 'rose', label: '玫红', swatch: 'hsl(350 89% 60%)'},
  {value: 'black', label: '黑色', swatch: 'hsl(0 0% 9%)'},
]

export const navIconOptions = [
  'Home',
  'User',
  'TrendingUp',
  'ShoppingCart',
  'PieChart',
  'Folder',
  'BookUser',
  'ClipboardCheck',
  'Shapes',
  'Tags',
  'Boxes',
  'Banknote',
] as const

export type NavIconName = (typeof navIconOptions)[number]

export const navIcons: Record<NavIconName, LucideIcon> = {
  Home,
  User,
  TrendingUp,
  ShoppingCart,
  PieChart,
  Folder,
  BookUser,
  ClipboardCheck,
  Shapes,
  Tags,
  Boxes,
  Banknote,
}

export interface AppMeta {
  id: string
  name: string
  iconName: AppIconName
  primaryColor: AppPrimaryColor
  description: string
  updatedAt: string
  ownedBusinessObjectNames?: string[]
}

export interface AppMenuItem {
  id: string
  businessObjectId: string
  label: string
  icon: LucideIcon
}

export interface AppApprovalFlow {
  id: string
  name: string
  businessObject: string
  applies: string
  state: '启用' | '停用'
  modifiedOn: string
}

export interface AppTriggerConfig {
  id: string
  name: string
  businessObject: string
  when: string
  action: string
  state: '启用' | '停用'
  modifiedOn: string
}

/* ---------------- 用户/部门 ---------------- */

export const currentUser: User = {
  id: '001-0000000000000001',
  name: 'admin',
  fullName: '超级管理员',
  email: 'admin@example.com',
  dept: '总部',
  role: '管理员',
  active: true,
  workphone: '0755-8899-0001',
  teams: ['研发团队', '销售团队'],
}

export const users: User[] = [
  currentUser,
  { id: '001-0000000000000002', name: 'zhaoyun', fullName: '赵云', email: 'zhaoyun@example.com', dept: '研发部', role: '研发工程师', active: true },
  { id: '001-0000000000000003', name: 'qianxun', fullName: '钱迅', email: 'qianxun@example.com', dept: '销售部', role: '销售经理', active: true },
  { id: '001-0000000000000004', name: 'sunli', fullName: '孙丽', email: 'sunli@example.com', dept: '销售部', role: '销售专员', active: true },
  { id: '001-0000000000000005', name: 'lijie', fullName: '李杰', email: 'lijie@example.com', dept: '财务部', role: '会计', active: true },
  { id: '001-0000000000000006', name: 'zhouwu', fullName: '周武', email: 'zhouwu@example.com', dept: '研发部', role: '前端工程师', active: true },
  { id: '001-0000000000000007', name: 'wuzheng', fullName: '吴征', email: 'wuzheng@example.com', dept: '市场部', role: '市场主管', active: true },
  { id: '001-0000000000000008', name: 'zhenhao', fullName: '郑浩', email: 'zhenhao@example.com', dept: '研发部', role: '后端工程师', active: false },
]

export const departments = [
  { id: '002-001', name: '总部', parent: null },
  { id: '002-002', name: '研发部', parent: '总部' },
  { id: '002-003', name: '销售部', parent: '总部' },
  { id: '002-004', name: '财务部', parent: '总部' },
  { id: '002-005', name: '市场部', parent: '总部' },
]

export const teams = [
  { id: '006-001', name: '研发团队', members: 3 },
  { id: '006-002', name: '销售团队', members: 2 },
  { id: '006-003', name: '市场团队', members: 2 },
]

/* ---------------- 业务对象元数据 ---------------- */

export const businessObjects: BusinessObjectMeta[] = [
  {
    name: 'Customer',
    label: '客户',
    icon: User,
    displayField: 'customerName',
    description: '客户信息管理',
    badge: 'CRM',
    fields: [
      { name: 'customerId', label: '客户编号', type: 'TEXT' },
      { name: 'customerName', label: '客户名称', type: 'TEXT' },
      {name: 'owningUser', label: '所属用户', type: 'REFERENCE', refBusinessObject: 'User'},
      { name: 'industry', label: '所属行业', type: 'SELECT', options: [
        { id: 'IND001', text: 'IT/互联网', color: '#18181b' },
        { id: 'IND002', text: '制造业', color: '#34a853' },
        { id: 'IND003', text: '金融', color: '#fbbc05' },
        { id: 'IND004', text: '教育', color: '#ea4335' },
      ] },
      { name: 'annualRevenue', label: '年营业额', type: 'DECIMAL' },
      { name: 'telephone', label: '电话', type: 'PHONE' },
      { name: 'email', label: '邮箱', type: 'EMAIL' },
      { name: 'address', label: '地址', type: 'TEXT' },
      { name: 'createdOn', label: '创建时间', type: 'DATETIME' },
      { name: 'modifiedOn', label: '修改时间', type: 'DATETIME' },
    ],
  },
  {
    name: 'Opportunity',
    label: '商机',
    icon: TrendingUp,
    displayField: 'opportunityName',
    description: '销售机会管理',
    badge: 'CRM',
    fields: [
      { name: 'opportunityId', label: '商机编号', type: 'TEXT' },
      { name: 'opportunityName', label: '商机名称', type: 'TEXT' },
      {name: 'customerId', label: '客户', type: 'REFERENCE', refBusinessObject: 'Customer'},
      { name: 'stage', label: '商机阶段', type: 'SELECT', options: [
        { id: 'STG001', text: '初步接触', color: '#9575cd' },
        { id: 'STG002', text: '需求确认', color: '#18181b' },
        { id: 'STG003', text: '方案报价', color: '#fbbc05' },
        { id: 'STG004', text: '商务谈判', color: '#ff6d00' },
        { id: 'STG005', text: '赢单', color: '#34a853' },
        { id: 'STG006', text: '输单', color: '#ea4335' },
      ] },
      { name: 'amount', label: '商机金额', type: 'DECIMAL' },
      { name: 'closingDate', label: '预计成交日期', type: 'DATE' },
      {name: 'owningUser', label: '所属用户', type: 'REFERENCE', refBusinessObject: 'User'},
      { name: 'createdOn', label: '创建时间', type: 'DATETIME' },
      { name: 'modifiedOn', label: '修改时间', type: 'DATETIME' },
    ],
  },
  {
    name: 'Product',
    label: '产品',
    icon: ShoppingCart,
    displayField: 'productName',
    description: '产品信息管理',
    badge: 'CRM',
    fields: [
      { name: 'productId', label: '产品编号', type: 'TEXT' },
      { name: 'productName', label: '产品名称', type: 'TEXT' },
      { name: 'price', label: '价格', type: 'DECIMAL' },
      { name: 'status', label: '上架状态', type: 'SELECT', options: [
        { id: 'PS001', text: '在售', color: '#34a853' },
        { id: 'PS002', text: '下架', color: '#ea4335' },
      ] },
      { name: 'createdOn', label: '创建时间', type: 'DATETIME' },
      { name: 'modifiedOn', label: '修改时间', type: 'DATETIME' },
    ],
  },
]

export function getBusinessObject(name: string): BusinessObjectMeta | undefined {
  return businessObjects.find((businessObject) => businessObject.name === name)
}

const expenseBusinessObject: BusinessObjectMeta = {
  name: 'Expense',
  label: '报销单',
  icon: Banknote,
  displayField: 'expenseName',
  description: '费用报销申请',
  badge: '报销',
  fields: [
    { name: 'expenseId', label: '报销编号', type: 'TEXT' },
    { name: 'expenseName', label: '报销事由', type: 'TEXT' },
    { name: 'category', label: '费用类型', type: 'SELECT', options: [
      { id: 'EX001', text: '交通费', color: '#34a853' },
      { id: 'EX002', text: '住宿费', color: '#18181b' },
      { id: 'EX003', text: '业务招待', color: '#fbbc05' },
      { id: 'EX004', text: '办公用品', color: '#ea4335' },
    ] },
    { name: 'amount', label: '报销金额', type: 'DECIMAL' },
    { name: 'submitDate', label: '提交日期', type: 'DATE' },
    {name: 'owningUser', label: '所属用户', type: 'REFERENCE', refBusinessObject: 'User'},
    { name: 'createdOn', label: '创建时间', type: 'DATETIME' },
    { name: 'modifiedOn', label: '修改时间', type: 'DATETIME' },
  ],
}

businessObjects.push(expenseBusinessObject)

export const apps: AppMeta[] = [
  {
    id: 'app-sales',
    name: '销售管理',
    iconName: 'ShoppingCart',
    primaryColor: 'indigo',
    description: '管理客户、商机和产品数据，跟踪销售全过程。',
    updatedAt: d(1, 16, 30),
    ownedBusinessObjectNames: [],
  },
  {
    id: 'app-expense',
    name: '报销管理',
    iconName: 'Banknote',
    primaryColor: 'blue',
    description: '提交和审核费用报销，沉淀常用报销流程。',
    updatedAt: d(2, 10, 15),
    ownedBusinessObjectNames: ['Expense'],
  },
]

const appMenus: Record<string, AppMenuItem[]> = {
  'app-sales': [
    {id: 'menu-customer', businessObjectId: 'Customer', label: '客户', icon: User},
    {id: 'menu-opportunity', businessObjectId: 'Opportunity', label: '商机', icon: TrendingUp},
    {id: 'menu-product', businessObjectId: 'Product', label: '产品', icon: ShoppingCart},
  ],
  'app-expense': [
    {id: 'menu-expense', businessObjectId: 'Expense', label: '报销单', icon: Banknote},
  ],
}

const appApprovalFlows: Record<string, AppApprovalFlow[]> = {
  'app-sales': [
    {
      id: 'af-001',
      name: '报价审批流程',
      businessObject: 'Opportunity',
      applies: '金额 > 50,000',
      state: '启用',
      modifiedOn: d(3, 10, 15)
    },
  ],
  'app-expense': [
    {
      id: 'af-101',
      name: '费用报销流程',
      businessObject: 'Expense',
      applies: '全部',
      state: '启用',
      modifiedOn: d(2, 14, 20)
    },
  ],
}

const appTriggers: Record<string, AppTriggerConfig[]> = {
  'app-sales': [
    {
      id: 'at-001',
      name: '新客户自动分配',
      businessObject: 'Customer',
      when: '新建时',
      action: '数据分配',
      state: '启用',
      modifiedOn: d(5, 11, 20)
    },
  ],
  'app-expense': [
    {
      id: 'at-101',
      name: '高额报销提醒',
      businessObject: 'Expense',
      when: '字段更新',
      action: '发送通知',
      state: '启用',
      modifiedOn: d(4, 9, 35)
    },
  ],
}

export function getApps(): AppMeta[] {
  return apps
}

export function getAppById(appId: string | undefined): AppMeta | undefined {
  return apps.find((app) => app.id === appId)
}

export function getAppMenus(appId: string | undefined): AppMenuItem[] {
  return appMenus[appId ?? ''] ?? []
}

export function getAppMenuItem(appId: string | undefined, menuId: string | undefined): AppMenuItem | undefined {
  return getAppMenus(appId).find((item) => item.id === menuId)
}

export function getAppBusinessObjects(appId: string | undefined): BusinessObjectMeta[] {
  return getAppMenus(appId)
    .map((item) => getBusinessObject(item.businessObjectId))
    .filter((item): item is BusinessObjectMeta => Boolean(item))
}

export function getAppMenuForBusinessObject(businessObjectName: string): { appId: string; menuId: string } | undefined {
  for (const app of apps) {
    const menu = getAppMenus(app.id).find((item) => item.businessObjectId === businessObjectName)
    if (menu) return { appId: app.id, menuId: menu.id }
  }
  return undefined
}

export type MenuLinkKind = 'system' | 'form'

export interface MenuLinkOption {
  id: string
  label: string
  kind: MenuLinkKind
  to: string
}

export const systemMenuLinks: MenuLinkOption[] = [
  {id: 'dashboard', label: '仪表盘', kind: 'system', to: '/dashboard/home'},
  {id: 'feeds', label: '动态', kind: 'system', to: '/feeds/home'},
  {id: 'files', label: '文件', kind: 'system', to: '/files/home'},
  {id: 'approval', label: '审批中心', kind: 'system', to: '/approval/home'},
  {id: 'contacts', label: '通讯录', kind: 'system', to: '/contacts/home'},
  {id: 'notifications', label: '通知', kind: 'system', to: '/notifications'},
]

export const formMenuLinks: MenuLinkOption[] = businessObjects.flatMap((businessObject) => {
  const menu = getAppMenuForBusinessObject(businessObject.name)
  return menu
    ? [{
      id: businessObject.name,
      label: businessObject.label,
      kind: 'form',
      to: `/apps/${menu.appId}/${menu.menuId}`,
    }]
    : []
})

export function getAppBusinessObjectCount(appId: string): number {
  return new Set(getAppMenus(appId).map((item) => item.businessObjectId)).size
}

export function getAppApprovalFlows(appId: string | undefined): AppApprovalFlow[] {
  return appApprovalFlows[appId ?? ''] ?? []
}

export function getAppTriggers(appId: string | undefined): AppTriggerConfig[] {
  return appTriggers[appId ?? ''] ?? []
}

function createAppId(name: string) {
  const prefix = `app-${Date.now().toString(36)}`
  return prefix || `app-${name}`
}

export function createApp(values: Omit<AppMeta, 'id' | 'updatedAt' | 'ownedBusinessObjectNames'>): AppMeta {
  const app: AppMeta = {
    ...values,
    id: createAppId(values.name),
    updatedAt: d(0, 12, 0),
    ownedBusinessObjectNames: [],
  }
  apps.unshift(app)
  appMenus[app.id] = []
  appApprovalFlows[app.id] = []
  appTriggers[app.id] = []
  return app
}

export function updateApp(appId: string, values: Omit<AppMeta, 'id' | 'updatedAt' | 'ownedBusinessObjectNames'>): AppMeta | undefined {
  const index = apps.findIndex((app) => app.id === appId)
  if (index < 0) return undefined
  const updated: AppMeta = {
    ...apps[index],
    ...values,
    id: appId,
    updatedAt: d(0, 12, 0),
  }
  apps[index] = updated
  return updated
}

export function deleteApp(appId: string): boolean {
  const index = apps.findIndex((app) => app.id === appId)
  if (index < 0) return false

  const ownedBusinessObjectNames = new Set(apps[index].ownedBusinessObjectNames ?? [])
  const hasOtherOwner = (businessObjectName: string) => apps.some(
    (app) => app.id !== appId && (app.ownedBusinessObjectNames ?? []).includes(businessObjectName),
  )
  ownedBusinessObjectNames.forEach((businessObjectName) => {
    if (!hasOtherOwner(businessObjectName)) {
      const businessObjectIndex = businessObjects.findIndex((businessObject) => businessObject.name === businessObjectName)
      if (businessObjectIndex >= 0) businessObjects.splice(businessObjectIndex, 1)
      delete recordSets[businessObjectName]
      Object.keys(appMenus).forEach((ownerId) => {
        appMenus[ownerId] = appMenus[ownerId].filter((item) => item.businessObjectId !== businessObjectName)
      })
    }
  })

  delete appMenus[appId]
  delete appApprovalFlows[appId]
  delete appTriggers[appId]
  apps.splice(index, 1)
  return true
}

/* ---------------- 记录数据 ---------------- */

function d(daysAgo: number, hour = 10, min = 24) {
  const t = new Date(2026, 8, 8, hour, min)
  t.setDate(t.getDate() - daysAgo)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

function dd(daysAgo: number) {
  return d(daysAgo).slice(0, 10)
}

function mkRows(businessObject: string, count: number, gen: (i: number) => Record<string, unknown>) {
  const rows: RbRecord[] = []
  for (let i = 1; i <= count; i++) rows.push({id: `${businessObject.toUpperCase().slice(0, 3)}-${String(1000 + i)}`, ...gen(i)})
  return rows
}

const industry = (i: number) => ['IT/互联网', '制造业', '金融', '教育'][i % 4]
const stage = (i: number) => ['初步接触', '需求确认', '方案报价', '商务谈判', '赢单', '输单'][i % 6]
function uname(index: number) {
  return users[(index % (users.length - 1)) + 1].fullName
}

const companyNames = [
  '华辰科技有限公司', '深圳市数联集团', '北京云图信息技术', '杭州点智网络', '上海临港智造',
  '广州启帆实业', '成都天府软件', '南京紫金山数据', '武汉光谷云', '西安丝路智联',
  '重庆两江数科', '苏州金鸡湖互联', '长沙麓谷信息', '青岛海湾智控', '厦门鹭岛云商',
  '合肥科大智能', '天津海河数媒', '昆明春城科技', '郑州中原智网', '济南泉城信息',
]

export const customerRecords: RbRecord[] = mkRows('CST', 20, (i) => ({
  customerId: `C${String(2026).padStart(4, '0')}-${String(i).padStart(3, '0')}`,
  customerName: companyNames[i - 1],
  owningUser: uname(i + 3),
  industry: industry(i),
  annualRevenue: [1200, 860, 4300, 950, 2800, 640, 3100, 720, 1500, 3900][i % 10] + (i * 37) % 400,
  telephone: `0755-88${String(8800000 + i * 1357).slice(0, 6)}`,
  email: `contact${i}@company${i}.com.cn`,
  address: `北京市海淀区中关村大街${27 + i}号院${(i % 8) + 1}号楼`,
  createdOn: d(60 - i * 2, 9 + (i % 8)),
  modifiedOn: d(i % 20, 14 + (i % 6), (i * 7) % 60),
}))

export const opportunityRecords: RbRecord[] = mkRows('OPP', 24, (i) => ({
  opportunityId: `OPP-${String(3001 + i)}`,
  opportunityName: `${companyNames[(i - 1) % 20].slice(0, 6)} - ${['ERP 系统', '智慧园区', '数据中台', '云迁移', '安全运维'][i % 5]}采购项目`,
  customerId: customerRecords[(i - 1) % 20].customerName,
  stage: stage(i),
  amount: [58, 120, 36, 240, 88, 65, 150, 32, 78, 300][i % 10] + (i % 7),
  closingDate: dd(-90 + i * 6),
  owningUser: uname(i + 1),
  createdOn: d(45 - i, 8 + (i % 9)),
  modifiedOn: d(i % 15, 10 + (i % 7), (i * 11) % 60),
}))

export const productRecords: RbRecord[] = mkRows('PRD', 12, (i) => ({
  productId: `P-${String(100 + i)}`,
  productName: ['商业版', '开源版', '数据集成服务', '私有化部署服务', '定制开发服务', '技术支持年费', '培训服务', '云存储空间', 'AI 助手模块', '移动端模块', '报表模块', '流程引擎模块'][(i - 1) % 12],
  price: [58000, 0, 12000, 35000, 80000, 9800, 5600, 2600, 19800, 8800, 6800, 12800][(i - 1) % 12],
  status: i <= 9 ? '在售' : '下架',
  createdOn: d(120 - i * 8, 10),
  modifiedOn: d(i % 30, 16, 30),
}))

const recordSets: Record<string, RbRecord[]> = {
  Customer: customerRecords,
  Opportunity: opportunityRecords,
  Product: productRecords,
}

export const expenseRecords: RbRecord[] = [
  { id: 'EXP-1001', expenseId: 'BX-2026-001', expenseName: '上海客户出差', category: '交通费', amount: 4280, submitDate: '2026-09-05', owningUser: uname(1), createdOn: d(2, 9, 12), modifiedOn: d(1, 16, 20) },
  { id: 'EXP-1002', expenseId: 'BX-2026-002', expenseName: '客户招待费用', category: '业务招待', amount: 1680, submitDate: '2026-09-04', owningUser: uname(3), createdOn: d(3, 11, 20), modifiedOn: d(2, 15, 5) },
  { id: 'EXP-1003', expenseId: 'BX-2026-003', expenseName: '项目培训报名', category: '办公用品', amount: 2400, submitDate: '2026-09-01', owningUser: uname(2), createdOn: d(6, 14, 30), modifiedOn: d(5, 10, 40) },
]

recordSets.Expense = expenseRecords

export function getRecords(businessObject: string): RbRecord[] {
  return recordSets[businessObject] ?? []
}

export function getRecord(businessObject: string, id: string): RbRecord | undefined {
  return getRecords(businessObject).find((record) => record.id === id)
}

export function createRecord(businessObject: string, values: Record<string, unknown>): RbRecord | undefined {
  const meta = getBusinessObject(businessObject)
  const records = getRecords(businessObject)
  if (!meta) return undefined

  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const record: RbRecord = {
    id: `${businessObject.slice(0, 3).toUpperCase()}-${records.length + 1001}`,
    ...values,
    createdOn: stamp,
    modifiedOn: stamp,
  }
  records.unshift(record)
  return record
}

export function updateRecord(businessObject: string, id: string, values: Record<string, unknown>): RbRecord | undefined {
  const records = getRecords(businessObject)
  const index = records.findIndex((record) => record.id === id)
  if (index < 0) return undefined

  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const updated: RbRecord = {
    ...records[index],
    ...values,
    modifiedOn: stamp,
  }
  records[index] = updated
  return updated
}

/* ---------------- 审批 ---------------- */

export interface ApprovalItem {
  id: string
  formLabel: string
  recordName: string
  applicant: string
  submittedOn: string
  status: '待审批' | '已通过' | '已驳回'
  currentNode: string
  content: string
}

export const approvals: ApprovalItem[] = [
  {
    id: '031-0001',
    formLabel: '报销单',
    recordName: '差旅费报销 - 上海出差',
    applicant: '赵云',
    submittedOn: d(1, 9, 12),
    status: '待审批',
    currentNode: '部门经理审批',
    content: '申请报销差旅费 4,280 元'
  },
  {
    id: '031-0002',
    formLabel: '请假单',
    recordName: '年假申请 - 孙丽',
    applicant: '孙丽',
    submittedOn: d(1, 10, 5),
    status: '待审批',
    currentNode: '人事备案',
    content: '年假 3 天（09-10 ~ 09-12）'
  },
  {
    id: '031-0003',
    formLabel: '报价单',
    recordName: '华辰科技 - ERP 报价',
    applicant: '钱迅',
    submittedOn: d(2, 15, 40),
    status: '待审批',
    currentNode: '总经理审批',
    content: '总金额 120,000 元，折扣 88%'
  },
  {
    id: '031-0004',
    formLabel: '报销单',
    recordName: '招待费报销',
    applicant: '吴征',
    submittedOn: d(3, 11, 20),
    status: '待审批',
    currentNode: '财务复核',
    content: '客户招待费 1,680 元'
  },
  {
    id: '031-0005',
    formLabel: '合同评审',
    recordName: '深圳数联 - 智慧园区合同',
    applicant: '钱迅',
    submittedOn: d(4, 16, 8),
    status: '待审批',
    currentNode: '法务审批',
    content: '合同金额 580,000 元'
  },
  {
    id: '031-0006',
    formLabel: '请假单',
    recordName: '调休申请 - 周武',
    applicant: '周武',
    submittedOn: d(5, 9, 45),
    status: '已通过',
    currentNode: '流程结束',
    content: '调休 1 天（09-09）'
  },
  {
    id: '031-0007',
    formLabel: '报销单',
    recordName: '办公用品采购报销',
    applicant: '李杰',
    submittedOn: d(6, 14, 30),
    status: '已通过',
    currentNode: '流程结束',
    content: '办公耗材 960 元'
  },
  {
    id: '031-0008',
    formLabel: '报价单',
    recordName: '北京云图 - 云迁移报价',
    applicant: '孙丽',
    submittedOn: d(7, 10, 15),
    status: '已通过',
    currentNode: '流程结束',
    content: '总金额 86,000 元，折扣 95%'
  },
  {
    id: '031-0009',
    formLabel: '合同评审',
    recordName: '杭州点智 - 数据中台合同',
    applicant: '赵云',
    submittedOn: d(9, 17, 22),
    status: '已驳回',
    currentNode: '流程结束',
    content: '合同金额 320,000 元（付款条款未达标）'
  },
  {
    id: '031-0010',
    formLabel: '报销单',
    recordName: '培训费报销',
    applicant: '孙丽',
    submittedOn: d(11, 9, 5),
    status: '已通过',
    currentNode: '流程结束',
    content: '技术大会门票 2,400 元'
  },
]

/* ---------------- 通知 ---------------- */

export interface Notification {
  id: string
  type: 10 | 20 | 30 | 40
  unread: boolean
  fromUser: string
  message: string
  time: string
}

export const notifications: Notification[] = [
  { id: '021-01', type: 20, unread: true, fromUser: '钱迅', message: '提交的《华辰科技 - ERP 报价》需要你审批', time: '10 分钟前' },
  { id: '021-02', type: 10, unread: true, fromUser: '超级管理员', message: '分配了 2 条客户记录给你', time: '32 分钟前' },
  { id: '021-03', type: 30, unread: true, fromUser: '赵云', message: '在动态中提到了你：@admin 这个方案需要评审一下', time: '1 小时前' },
  { id: '021-04', type: 20, unread: true, fromUser: '孙丽', message: '提交的《年假申请 - 孙丽》需要你审批', time: '2 小时前' },
  { id: '021-05', type: 40, unread: false, fromUser: '周武', message: '在项目「v4.5 发布」中指派了任务给你', time: '昨天 17:42' },
  { id: '021-06', type: 30, unread: false, fromUser: '吴征', message: '发布了新的公司公告《关于国庆放假安排》', time: '昨天 14:05' },
  { id: '021-07', type: 10, unread: false, fromUser: '超级管理员', message: '共享了仪表盘「销售数据大盘」给你', time: '前天 09:30' },
  { id: '021-08', type: 20, unread: false, fromUser: '系统', message: '你提交的《办公用品采购报销》已审批通过', time: '3 天前' },
]

/* ---------------- 动态 Feeds ---------------- */

export interface Feed {
  id: string
  type: 1 | 2 | 3 | 4
  content: string
  contentHtml: string
  author: string
  time: string
  likes: number
  comments: { author: string; content: string; time: string }[]
  scope: '公开' | '部门'
}

export const feeds: Feed[] = [
  {
    id: '044-01', type: 1, author: '赵云', time: '今天 09:24', likes: 6, scope: '公开',
    content: 'v4.5 版本的技术方案已经完成初稿，重点包括新的流程引擎和仪表盘编辑器，欢迎大家评审。',
    contentHtml: 'v4.5 版本的技术方案已经完成初稿，重点包括新的<b>流程引擎</b>和<b>仪表盘编辑器</b>，欢迎大家评审。',
    comments: [
      { author: '周武', content: '仪表盘编辑器部分我补充了交互稿，稍后同步。', time: '今天 09:40' },
      { author: '钱迅', content: '客户那边也在问新版本的时间点，加油！', time: '今天 10:02' },
    ],
  },
  {
    id: '044-02', type: 2, author: '钱迅', time: '昨天 16:50', likes: 2, scope: '公开',
    content: '【跟进】拜访了华辰科技，对 ERP 模块需求明确，预计下周可以进入商务谈判阶段。',
    contentHtml: '【跟进】拜访了<b>华辰科技</b>，对 ERP 模块需求明确，预计下周可以进入商务谈判阶段。',
    comments: [{ author: '超级管理员', content: '很好，报价方案记得同步法务评审。', time: '昨天 17:10' }],
  },
  {
    id: '044-03', type: 4, author: '孙丽', time: '昨天 09:00', likes: 0, scope: '部门',
    content: '9:00 晨会：同步本周销售目标与重点客户跟进计划。',
    contentHtml: '9:00 晨会：同步本周销售目标与重点客户跟进计划。',
    comments: [],
  },
  {
    id: '044-04', type: 3, author: '超级管理员', time: '2 天前', likes: 12, scope: '公开',
    content: '【公告】公司将于下月组织团建活动，请大家在本周五前填写意向问卷。',
    contentHtml: '【公告】公司将于下月组织<b>团建活动</b>，请大家在本周五前填写意向问卷。',
    comments: [
      { author: '李杰', content: '收到！', time: '2 天前' },
      { author: '吴征', content: '期待！', time: '2 天前' },
    ],
  },
  {
    id: '044-05', type: 1, author: '周武', time: '3 天前', likes: 4, scope: '公开',
    content: '移动端适配的联调已完成 80%，iPhone 与 Android 主流机型均已通过测试。',
    contentHtml: '移动端适配的联调已完成 <b>80%</b>，iPhone 与 Android 主流机型均已通过测试。',
    comments: [],
  },
]

/* ---------------- 文件管理 ---------------- */

export interface FileNode {
  id: string
  name: string
  type: 'folder' | 'file'
  size?: string
  modifiedOn: string
  fileCount?: number
  ext?: string
}

export const fileTree: Record<string, FileNode[]> = {
  '': [
    { id: 'f-01', name: '公司文档', type: 'folder', fileCount: 24, modifiedOn: d(1, 15, 30) },
    { id: 'f-02', name: '产品资料', type: 'folder', fileCount: 18, modifiedOn: d(3, 10, 12) },
    { id: 'f-03', name: '项目交付', type: 'folder', fileCount: 36, modifiedOn: d(6, 14, 20) },
    { id: 'f-04', name: '市场活动', type: 'folder', fileCount: 12, modifiedOn: d(9, 11, 5) },
    { id: 'f-05', name: '产品介绍.pptx', type: 'file', size: '15.4 MB', ext: 'pptx', modifiedOn: d(1, 9, 40) },
    { id: 'f-06', name: '2026 年度经营计划.xlsx', type: 'file', size: '2.1 MB', ext: 'xlsx', modifiedOn: d(2, 16, 8) },
    { id: 'f-07', name: '员工手册.pdf', type: 'file', size: '4.7 MB', ext: 'pdf', modifiedOn: d(5, 13, 45) },
    { id: 'f-08', name: '系统架构图.png', type: 'file', size: '860 KB', ext: 'png', modifiedOn: d(7, 10, 22) },
  ],
  'f-01': [
    { id: 'f-0101', name: '规章制度', type: 'folder', fileCount: 8, modifiedOn: d(2, 11, 0) },
    { id: 'f-0102', name: '考勤与假期制度.pdf', type: 'file', size: '920 KB', ext: 'pdf', modifiedOn: d(2, 11, 10) },
    { id: 'f-0103', name: '费用报销流程.docx', type: 'file', size: '310 KB', ext: 'docx', modifiedOn: d(4, 9, 30) },
    { id: 'f-0104', name: '劳动合同模板.docx', type: 'file', size: '260 KB', ext: 'docx', modifiedOn: d(8, 15, 12) },
  ],
  'f-02': [
    { id: 'f-0201', name: '产品白皮书.pdf', type: 'file', size: '6.8 MB', ext: 'pdf', modifiedOn: d(3, 10, 0) },
    { id: 'f-0202', name: '功能清单.xlsx', type: 'file', size: '780 KB', ext: 'xlsx', modifiedOn: d(3, 10, 5) },
    { id: 'f-0203', name: '竞品分析.docx', type: 'file', size: '1.2 MB', ext: 'docx', modifiedOn: d(10, 14, 0) },
  ],
  'f-03': [
    { id: 'f-0301', name: '华辰科技', type: 'folder', fileCount: 15, modifiedOn: d(6, 14, 0) },
    { id: 'f-0302', name: '验收报告模板.docx', type: 'file', size: '220 KB', ext: 'docx', modifiedOn: d(6, 14, 8) },
    { id: 'f-0303', name: '项目周报模板.xlsx', type: 'file', size: '96 KB', ext: 'xlsx', modifiedOn: d(11, 9, 0) },
  ],
}

/* ---------------- 项目 ---------------- */

export interface ProjectPlan {
  id: string
  name: string
  tasks: ProjectTask[]
}

export interface ProjectTask {
  id: string
  projectId: string
  planId: string
  title: string
  priority: '高' | '中' | '低'
  executor: string
  deadline: string
  finished: boolean
  progress: number
}

export const projects = [
  { id: '040-001', code: 'PRJ', name: 'v4.5 发布', icon: Shapes, scope: 1, status: 1, progress: 62, plans: 2 },
  { id: '040-002', code: 'OPS', name: '华辰科技 ERP 实施', icon: Shapes, scope: 2, status: 1, progress: 35, plans: 3 },
]

export const projectPlans: ProjectPlan[] = [
  { id: 'plan-1', name: '待办', tasks: [
    { id: 't-101', projectId: '040-001', planId: 'plan-1', title: '整理 v4.5 发布清单', priority: '中', executor: '赵云', deadline: dd(-6), finished: false, progress: 0 },
    { id: 't-102', projectId: '040-001', planId: 'plan-1', title: '更新产品官网文档', priority: '低', executor: '吴征', deadline: dd(-9), finished: false, progress: 0 },
    { id: 't-103', projectId: '040-001', planId: 'plan-1', title: '回归测试第二轮', priority: '高', executor: '周武', deadline: dd(-3), finished: false, progress: 0 },
  ]},
  { id: 'plan-2', name: '进行中', tasks: [
    { id: 't-201', projectId: '040-001', planId: 'plan-2', title: '流程引擎单元测试', priority: '高', executor: '赵云', deadline: dd(-1), finished: false, progress: 70 },
    { id: 't-202', projectId: '040-001', planId: 'plan-2', title: '移动端联调', priority: '中', executor: '周武', deadline: dd(-2), finished: false, progress: 80 },
    { id: 't-203', projectId: '040-001', planId: 'plan-2', title: '发布说明撰写', priority: '低', executor: '吴征', deadline: dd(-8), finished: false, progress: 30 },
  ]},
  { id: 'plan-3', name: '已完成', tasks: [
    { id: 't-301', projectId: '040-001', planId: 'plan-3', title: '技术方案评审', priority: '高', executor: '赵云', deadline: dd(4), finished: true, progress: 100 },
    { id: 't-302', projectId: '040-001', planId: 'plan-3', title: 'UI 设计定稿', priority: '中', executor: '孙丽', deadline: dd(2), finished: true, progress: 100 },
  ]},
]

/* ---------------- 仪表盘图表配置 ---------------- */

export interface DashChart {
  id: string
  title: string
  type: 'bar' | 'line' | 'pie' | 'dataloader' | 'index'
  w: number
  h: number
  x: number
  y: number
}

export const dashboards = [
  { id: 'dash-0', name: '默认仪表盘' },
  { id: 'dash-1', name: '销售数据大盘' },
]

export const dashCharts: Record<string, DashChart[]> = {
  'dash-0': [
    { id: 'c-01', title: '本月新增客户', type: 'index', w: 2, h: 4, x: 0, y: 0 },
    { id: 'c-02', title: '本月赢单商机', type: 'index', w: 2, h: 4, x: 2, y: 0 },
    { id: 'c-03', title: '客户行业分布', type: 'pie', w: 4, h: 6, x: 4, y: 0 },
    { id: 'c-04', title: '近 12 个月新增客户趋势', type: 'line', w: 6, h: 6, x: 0, y: 4 },
    { id: 'c-05', title: '商机金额（按阶段）', type: 'bar', w: 6, h: 6, x: 6, y: 4 },
    { id: 'c-06', title: '销售业绩排行', type: 'dataloader', w: 12, h: 7, x: 0, y: 10 },
  ],
  'dash-1': [
    { id: 'c-11', title: '销售目标完成率', type: 'index', w: 3, h: 4, x: 0, y: 0 },
    { id: 'c-12', title: '商机阶段漏斗', type: 'pie', w: 4, h: 6, x: 3, y: 0 },
    { id: 'c-13', title: '月度回款', type: 'bar', w: 5, h: 6, x: 7, y: 0 },
  ],
}

/* ---------------- 图表数据 ---------------- */

export const chartData = {
  newCustomers12m: {
    months: ['10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月'],
    values: [18, 22, 26, 15, 20, 24, 28, 31, 25, 29, 34, 20],
  },
  industryDist: [
    { name: 'IT/互联网', value: 42 },
    { name: '制造业', value: 26 },
    { name: '金融', value: 18 },
    { name: '教育', value: 14 },
  ],
  stageAmount: {
    stages: ['初步接触', '需求确认', '方案报价', '商务谈判', '赢单'],
    values: [120, 240, 385, 520, 680],
  },
  monthlyPayment: {
    months: ['4月', '5月', '6月', '7月', '8月', '9月'],
    values: [82, 95, 120, 105, 138, 156],
  },
  salesRank: [
    { name: '钱迅', dept: '销售部', target: 500, done: 468, rate: '93.6%' },
    { name: '孙丽', dept: '销售部', target: 400, done: 305, rate: '76.3%' },
    { name: '吴征', dept: '市场部', target: 300, done: 288, rate: '96.0%' },
    { name: '赵云', dept: '研发部', target: 200, done: 122, rate: '61.0%' },
  ],
}

/* ---------------- 导航配置（NavBuilder 默认 + 业务对象） ---------------- */

export interface NavItem {
  id: string
  icon?: LucideIcon
  text: string
  to?: string
  sub?: NavItem[]
}

export const userNavs: NavItem[] = [
  { id: 'dashboard-home', icon: Home, text: '首页', to: '/dashboard/home' },
  {id: 'nav_form-Customer', icon: User, text: '客户', to: '/apps/app-sales/menu-customer'},
  {id: 'nav_form-Opportunity', icon: TrendingUp, text: '商机', to: '/apps/app-sales/menu-opportunity'},
  {id: 'nav_form-Product', icon: ShoppingCart, text: '产品', to: '/apps/app-sales/menu-product'},
  {
    id: 'group-common',
    icon: Folder,
    text: '常用',
    sub: [
      {id: 'nav_form--FEEDS', icon: PieChart, text: '动态', to: '/feeds/home'},
      {id: 'nav_form--ATTACHMENT', icon: Folder, text: '文件', to: '/files/home'},
      {id: 'nav_form--CONTACTS', icon: BookUser, text: '通讯录', to: '/contacts/home'},
      {id: 'nav_form--APPROVAL', icon: ClipboardCheck, text: '审批中心', to: '/approval/home'},
    ],
  },
  {
    id: 'nav_form--PROJECT',
    icon: Shapes,
    text: '项目',
    sub: projects.map((p) => ({ id: `nav_project-${p.id}`, icon: Tags, text: p.name, to: `/project/${p.id}/tasks` })),
  },
]

export interface TopNavItem {
  id: string
  text: string
  to: string
  match?: string[]
  navs: NavItem[]
}

export interface TopMenuItemInput {
  text: string
}

export type LeftMenuItemType = 'menu' | 'group'

export interface LeftMenuItemInput {
  text: string
  to?: string
  icon?: LucideIcon
  type?: LeftMenuItemType
}

let menuSequence = 0

function nextMenuId(prefix: string) {
  menuSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${menuSequence}`
}

function nextMenuPath(id: string) {
  return `/menu/${id}`
}

const customerNavs: NavItem[] = [
  {id: 'nav_form-Customer', icon: User, text: '客户', to: '/apps/app-sales/menu-customer'},
  {id: 'nav_form-Opportunity', icon: TrendingUp, text: '商机', to: '/apps/app-sales/menu-opportunity'},
  {id: 'nav_form--CONTACTS', icon: BookUser, text: '通讯录', to: '/contacts/home'},
  {
    id: 'group-customer-collaboration',
    icon: Folder,
    text: '协作',
    sub: [
      {id: 'nav_form--FEEDS', icon: PieChart, text: '动态', to: '/feeds/home'},
      {id: 'nav_form--ATTACHMENT', icon: Folder, text: '文件', to: '/files/home'},
      {id: 'nav_form--APPROVAL', icon: ClipboardCheck, text: '审批中心', to: '/approval/home'},
    ],
  },
]

const salesNavs: NavItem[] = [
  {id: 'nav_form-Opportunity', icon: TrendingUp, text: '商机', to: '/apps/app-sales/menu-opportunity'},
  {id: 'nav_form-Product', icon: ShoppingCart, text: '产品', to: '/apps/app-sales/menu-product'},
  {id: 'nav_form-Customer', icon: User, text: '客户', to: '/apps/app-sales/menu-customer'},
  {
    id: 'group-sales-follow',
    icon: Folder,
    text: '跟进',
    sub: [
      {id: 'nav_form--FEEDS', icon: PieChart, text: '动态', to: '/feeds/home'},
      {id: 'nav_form--ATTACHMENT', icon: Folder, text: '文件', to: '/files/home'},
    ],
  },
]

export const topNavs: TopNavItem[] = [
  {
    id: 'top-workbench',
    text: '工作台',
    to: '/dashboard/home',
    match: ['/dashboard/home'],
    navs: userNavs,
  },
  {
    id: 'top-customer',
    text: '客户',
    to: '/apps/app-sales/menu-customer',
    match: ['/apps/app-sales'],
    navs: customerNavs,
  },
  {
    id: 'top-sales',
    text: '销售',
    to: '/apps/app-sales/menu-opportunity',
    match: ['/apps/app-sales'],
    navs: salesNavs,
  },
]

export function getTopNavs(): TopNavItem[] {
  return topNavs
}

export function getTopNavById(id: string | undefined): TopNavItem | undefined {
  return topNavs.find((nav) => nav.id === id)
}

export function createTopMenu(values: TopMenuItemInput): TopNavItem {
  const id = nextMenuId('top')
  const menu: TopNavItem = {
    id,
    text: values.text,
    to: nextMenuPath(id),
    match: [nextMenuPath(id)],
    navs: [],
  }
  topNavs.push(menu)
  return menu
}

export function updateTopMenu(id: string, values: TopMenuItemInput): TopNavItem | undefined {
  const menu = getTopNavById(id)
  if (!menu) return undefined
  menu.text = values.text
  return menu
}

export function deleteTopMenu(id: string): boolean {
  if (topNavs.length <= 1) return false
  const index = topNavs.findIndex((nav) => nav.id === id)
  if (index < 0) return false
  topNavs.splice(index, 1)
  return true
}

export function reorderTopMenus(orderedIds: string[]): void {
  const menusById = new Map(topNavs.map((nav) => [nav.id, nav]))
  topNavs.length = 0
  orderedIds.forEach((id) => {
    const menu = menusById.get(id)
    if (menu) topNavs.push(menu)
  })
}

export function createLeftMenu(topMenuId: string, values: LeftMenuItemInput): NavItem | undefined {
  const topMenu = getTopNavById(topMenuId)
  if (!topMenu) return undefined
  const isGroup = values.type === 'group'
  const id = nextMenuId('nav')
  const menu: NavItem = {
    id,
    text: values.text,
    to: isGroup ? undefined : (values.to ?? nextMenuPath(id)),
    icon: values.icon,
    sub: isGroup ? [] : undefined,
  }
  topMenu.navs.push(menu)
  return menu
}

export function updateLeftMenu(
  topMenuId: string,
  menuId: string,
  values: LeftMenuItemInput,
): NavItem | undefined {
  const topMenu = getTopNavById(topMenuId)
  const menu = topMenu?.navs.find((item) => item.id === menuId)
  if (!menu) return undefined
  const isGroup = values.type === 'group'
  menu.text = values.text
  menu.to = isGroup ? undefined : (values.to ?? menu.to ?? nextMenuPath(menu.id))
  menu.icon = values.icon
  menu.sub = isGroup ? (menu.sub ?? []) : undefined
  return menu
}

export function deleteLeftMenu(topMenuId: string, menuId: string): boolean {
  const topMenu = getTopNavById(topMenuId)
  if (!topMenu) return false
  const index = topMenu.navs.findIndex((item) => item.id === menuId)
  if (index < 0) return false
  topMenu.navs.splice(index, 1)
  return true
}

export function reorderLeftMenus(topMenuId: string, orderedIds: string[]): void {
  const topMenu = getTopNavById(topMenuId)
  if (!topMenu) return
  const menusById = new Map(topMenu.navs.map((item) => [item.id, item]))
  topMenu.navs.length = 0
  orderedIds.forEach((id) => {
    const menu = menusById.get(id)
    if (menu) topMenu.navs.push(menu)
  })
}

export function getLeftMenuGroup(
  topMenuId: string,
  groupId: string,
): (NavItem & { sub: NavItem[] }) | undefined {
  const topMenu = getTopNavById(topMenuId)
  const group = topMenu?.navs.find((item) => item.id === groupId && item.sub)
  return group && Array.isArray(group.sub) ? (group as NavItem & { sub: NavItem[] }) : undefined
}

export function createLeftSubmenu(
  topMenuId: string,
  groupId: string,
  values: LeftMenuItemInput,
): NavItem | undefined {
  const group = getLeftMenuGroup(topMenuId, groupId)
  if (!group) return undefined
  const id = nextMenuId('nav')
  const menu: NavItem = {
    id,
    text: values.text,
    to: values.to ?? nextMenuPath(id),
    icon: values.icon,
  }
  group.sub.push(menu)
  return menu
}

export function updateLeftSubmenu(
  topMenuId: string,
  groupId: string,
  menuId: string,
  values: LeftMenuItemInput,
): NavItem | undefined {
  const group = getLeftMenuGroup(topMenuId, groupId)
  const menu = group?.sub.find((item) => item.id === menuId)
  if (!menu) return undefined
  menu.text = values.text
  menu.to = values.to ?? menu.to ?? nextMenuPath(menu.id)
  menu.icon = values.icon
  return menu
}

export function deleteLeftSubmenu(
  topMenuId: string,
  groupId: string,
  menuId: string,
): boolean {
  const group = getLeftMenuGroup(topMenuId, groupId)
  if (!group) return false
  const index = group.sub.findIndex((item) => item.id === menuId)
  if (index < 0) return false
  group.sub.splice(index, 1)
  return true
}

export function reorderLeftSubmenus(
  topMenuId: string,
  groupId: string,
  orderedIds: string[],
): void {
  const group = getLeftMenuGroup(topMenuId, groupId)
  if (!group) return
  const menusById = new Map(group.sub.map((item) => [item.id, item]))
  group.sub.length = 0
  orderedIds.forEach((id) => {
    const menu = menusById.get(id)
    if (menu) group.sub.push(menu)
  })
}

export function getTopNavIdByPath(pathname: string, preferredTopId?: string) {
  const preferred = getTopNavById(preferredTopId)
  if (preferred && (preferred.to === pathname || preferred.navs.some((item) => navMatchesPath(item, pathname)))) {
    return preferred.id
  }

  const exact = topNavs.find((nav) => nav.to === pathname || nav.navs.some((item) => navMatchesPath(item, pathname)))
  if (exact) return exact.id

  const match = topNavs.find((nav) =>
    nav.match?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  )
  return match?.id ?? topNavs[0].id
}

function navMatchesPath(item: NavItem, pathname: string): boolean {
  return (
    item.to === pathname ||
    Boolean(item.to && pathname.startsWith(`${item.to}/`)) ||
    Boolean(item.sub?.some((child) => navMatchesPath(child, pathname)))
  )
}

/* ---------------- 通讯录 ---------------- */

export const contactsList = [
  { id: '090-01', name: '华辰科技', contact: '王经理', phone: '138-0000-1111', email: 'wang@huachen.com', owner: '钱迅' },
  { id: '090-02', name: '深圳数联集团', contact: '刘总', phone: '139-0000-2222', email: 'liu@shulian.com', owner: '钱迅' },
  { id: '090-03', name: '北京云图信息', contact: '张主管', phone: '137-0000-3333', email: 'zhang@yuntu.cn', owner: '孙丽' },
  { id: '090-04', name: '杭州点智网络', contact: '陈经理', phone: '136-0000-4444', email: 'chen@dianzhi.com', owner: '孙丽' },
  { id: '090-05', name: '上海临港智造', contact: '杨工', phone: '135-0000-5555', email: 'yang@lingang.com', owner: '吴征' },
]

/* ---------------- 登录日志 / 审计 ---------------- */

export const loginLogs = [
  { id: 'l-1', user: 'admin', ip: '192.168.1.100', agent: 'Chrome 128 · Windows', time: d(0, 9, 2), status: '成功' },
  { id: 'l-2', user: 'zhaoyun', ip: '192.168.1.101', agent: 'Chrome 128 · macOS', time: d(0, 8, 47), status: '成功' },
  { id: 'l-3', user: 'qianxun', ip: '10.20.30.40', agent: 'Safari 17 · iPhone', time: d(1, 18, 22), status: '成功' },
  { id: 'l-4', user: 'unknown', ip: '203.0.113.7', agent: 'Firefox 129 · Linux', time: d(1, 3, 12), status: '失败（密码错误）' },
  { id: 'l-5', user: 'sunli', ip: '192.168.1.104', agent: 'Edge 128 · Windows', time: d(2, 9, 15), status: '成功' },
]

export const recycleBin = [
  {id: 'r-1', formLabel: '客户', recordName: '东莞虎门制造（重复录入）', deletedBy: '钱迅', deletedOn: d(2, 11, 30)},
  {id: 'r-2', formLabel: '商机', recordName: '苏州金鸡湖互联 - 网站改版', deletedBy: '孙丽', deletedOn: d(4, 16, 44)},
  {id: 'r-3', formLabel: '产品', recordName: '旧版报表模块', deletedBy: 'admin', deletedOn: d(6, 10, 5)},
]
