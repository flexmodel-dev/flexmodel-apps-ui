import {
  Banknote,
  BookUser,
  ClipboardCheck,
  Folder,
  Home,
  PieChart,
  Shapes,
  ShoppingCart,
  Tags,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react'
import type {ApprovalFlow, ApprovalForm, MemberDirectory, RecordStore} from '../types/approval'
import {createApprovalNode, literal, newRule} from '../lib/approval'
import type {AppPrimaryColor} from '@/theme/appPrimaryColors'
import type {AppIconName} from '@/data/appIcons'

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

export interface AppMeta {
  id: string
  name: string
  iconName: AppIconName
  primaryColor: AppPrimaryColor
  description: string
  updatedAt: string
}

export interface AppMenuItem {
  id: string
  businessObjectId: string
  label: string
  icon: LucideIcon
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
  },
  {
    id: 'app-expense',
    name: '报销管理',
    iconName: 'Banknote',
    primaryColor: 'blue',
    description: '提交和审核费用报销，沉淀常用报销流程。',
    updatedAt: d(2, 10, 15),
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

export function getAppMenus(appId: string | undefined): AppMenuItem[] {
  return appMenus[appId ?? ''] ?? []
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
  {id: 'workbench', label: '工作台', kind: 'system', to: '/workbench/home'},
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

/* ---------------- 时间工具 ---------------- */

function d(daysAgo: number, hour = 10, min = 24) {
  const t = new Date(2026, 8, 8, hour, min)
  t.setDate(t.getDate() - daysAgo)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

function dd(daysAgo: number) {
  return d(daysAgo).slice(0, 10)
}

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
    content: 'v4.5 版本的技术方案已经完成初稿，重点包括新的流程引擎和工作台编辑器，欢迎大家评审。',
    contentHtml: 'v4.5 版本的技术方案已经完成初稿，重点包括新的<b>流程引擎</b>和<b>工作台编辑器</b>，欢迎大家评审。',
    comments: [
      {author: '周武', content: '工作台编辑器部分我补充了交互稿，稍后同步。', time: '今天 09:40'},
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

/* ---------------- 导航配置（NavBuilder 默认 + 业务对象） ---------------- */

export interface NavItem {
  id: string
  icon?: LucideIcon
  text: string
  to?: string
  sub?: NavItem[]
}

export const userNavs: NavItem[] = [
  {id: 'workbench-home', icon: Home, text: '首页', to: '/workbench/home'},
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
    to: '/workbench/home',
    match: ['/workbench/home'],
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
/* ---------------- 审批流程本地演示（不写入真实业务记录） ---------------- */
export const approvalDirectory: MemberDirectory = {
  members: users.filter(user => user.active).map(user => ({
    id: user.id, name: user.fullName, role: user.role,
    organization: departments.find(dept => dept.name === user.dept)!.id,
    managerId: user.id === currentUser.id ? undefined : user.name === 'sunli' ? users[2].id : currentUser.id,
  })),
  organizations: departments.map(dept => ({
    id: dept.id,
    name: dept.name,
    parentId: departments.find(parent => parent.name === dept.parent)?.id
  })),
}
export const approvalDemoForms: ApprovalForm[] = [{
  ref: {kind: 'demo', name: 'expense'}, label: '报销单（示例）',
  fields: [{name: 'id', label: '记录 ID', type: 'TEXT'}, {
    name: 'title',
    label: '报销事由',
    type: 'TEXT'
  }, {name: 'amount', label: '报销金额', type: 'DECIMAL'}, {
    name: 'category',
    label: '费用类型',
    type: 'TEXT'
  }, {name: 'status', label: '审批状态', type: 'TEXT'}],
}, {
  ref: {kind: 'demo', name: 'archive'}, label: '审批归档（示例）',
  fields: [{name: 'id', label: '记录 ID', type: 'TEXT'}, {
    name: 'title',
    label: '归档标题',
    type: 'TEXT'
  }, {name: 'amount', label: '金额', type: 'DECIMAL'}, {name: 'status', label: '状态', type: 'TEXT'}],
}]
export const approvalSampleVariables = {
  record: {
    id: 'EXP-001',
    title: '客户拜访差旅报销',
    amount: 8600,
    category: '差旅费',
    status: '待审批'
  }, reviewerIds: [users[4].id]
}
export const approvalSampleRecords: RecordStore = {
  'demo:expense': [approvalSampleVariables.record, {
    id: 'EXP-002',
    title: '办公用品采购',
    amount: 320,
    category: '办公费',
    status: '草稿'
  }],
  'demo:archive': [],
}

export function createApprovalTemplates(appId: string): ApprovalFlow[] {
  const node = createApprovalNode
  const archive = node('create')
  archive.data.title = '归档审批结果'
  if (archive.data.config.kind === 'create') {
    archive.data.config.form = {kind: 'demo', name: 'archive'}
    archive.data.config.assignments = [{
      id: 'archive-title',
      field: 'title',
      value: {kind: 'variable', value: 'record.title'}
    }, {id: 'archive-amount', field: 'amount', value: {kind: 'variable', value: 'record.amount'}}]
    archive.data.config.output = 'archiveRecord'
  }
  const manager = node('approval')
  manager.id = 'demo-manager';
  manager.data.title = '直属主管审批'
  if (manager.data.config.kind === 'approval') manager.data.config.rules = [{
    ...newRule(),
    source: 'initiator',
    scope: 'manager'
  }]
  const finance = node('approval')
  finance.data.title = '财务复核'
  if (finance.data.config.kind === 'approval') finance.data.config.rules = [{
    ...newRule(),
    source: 'roles',
    values: ['会计']
  }]
  const gateway = node('gateway')
  gateway.data.title = '报销金额判断'
  gateway.blocks![0].data.title = '大额报销'
  gateway.blocks![0].data.config = {
    kind: 'branch',
    fallback: false,
    match: 'all',
    conditions: [{id: 'amount-condition', field: 'record.amount', operator: 'gte', value: literal('5000')}]
  }
  gateway.blocks![0].blocks = [finance]
  gateway.blocks![1].data.title = '常规报销'
  const update = node('update')
  update.data.title = '更新报销状态'
  if (update.data.config.kind === 'update') {
    update.data.config.conditions = [{
      id: 'record-id',
      field: 'id',
      operator: 'eq',
      value: {kind: 'variable', value: 'record.id'}
    }]
    update.data.config.assignments = [{id: 'status-assignment', field: 'status', value: literal('已通过')}]
  }
  const subflow = node('subflow')
  subflow.data.title = '审批结果归档'
  subflow.data.config = {kind: 'subflow', flowId: 'demo-archive', inputs: [], outputs: []}
  return [{
    id: 'demo-expense',
    appId,
    name: '费用报销审批',
    description: '主管审批 → 金额分流 → 财务复核 → 自动归档',
    form: {kind: 'demo', name: 'expense'},
    status: 'enabled',
    updatedAt: new Date().toISOString(),
    definition: {nodes: [node('start'), manager, gateway, update, subflow, node('end')]}
  },
    {
      id: 'demo-archive',
      appId,
      name: '审批归档子流程',
      description: '将审批结果保存至归档表单，可被其他流程调用',
      form: {kind: 'demo', name: 'expense'},
      status: 'enabled',
      updatedAt: new Date().toISOString(),
      definition: {nodes: [node('start'), archive, node('end')]}
    }]
}
