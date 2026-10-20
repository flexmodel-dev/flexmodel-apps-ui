# AGENTS.md

## 项目定位

`flexmodel-apps` 是一个零代码平台前后端工程。应用、登录、菜单、表单配置与
工作台配置使用 `src/services/` 中的真实后端接口；尚未接入真实数据的演示内容继续使用 `src/data/mock.ts`。

## 技术栈

- React 18 + TypeScript + Vite
- React Router
- Tailwind CSS
- shadcn/ui 风格组件和 Radix UI
- Lucide 图标

## 常用命令

```bash
npm run dev
npm run build
npm run preview
```

修改代码后优先执行 `npm run build` 验证。

## 目录约定

- `src/components/ui/`：shadcn/ui 基础组件，保持默认样式。
- `src/components/layout/`：全局布局，包括 header、左侧菜单和内容区。
- `src/components/rb/`：业务复用组件，例如表单弹窗、分页器。
- `src/pages/`：页面级组件。
- `src/services/`：真实后端接口层与会话内缓存。
- `src/data/mock.ts`：实体元数据、记录、用户、导航等 mock 数据。
- `src/lib/utils.ts`：通用工具函数和 `cn()`。

## 数据与交互

- 已接入真实后端的配置能力必须通过 `src/services/` 请求，不要在组件中直接拼接后端 URL。
- 尚未接入真实接口的展示数据集中在 `src/data/mock.ts`，并在状态文档中标明遗留范围。
- 创建和修改记录使用弹窗表单，详情查看使用右侧 Drawer。
- 表格默认每页 30 条，支持行内选择和表内滚动。

## 布局与样式

- Header 固定在顶部，高度为 64px；左侧菜单使用固定定位，内容区必须扣除对应高度。
- 内容区避免出现多余的外层滚动条；滚动应放在表格、列表、Drawer 或仪表盘网格等明确的内容区域内。
- 样式优先使用 Tailwind 的语义 token，例如 `bg-background`、`bg-card`、`text-foreground`、`text-muted-foreground`、`border-border`。
- 主色统一通过 `--primary`、`--primary-foreground`、`--ring` 等变量控制，不要在组件中硬编码主题色。
- 使用 Lucide 图标；不要引入自定义图标字体或复杂渐变。
- 保持 shadcn/ui 默认视觉风格，不要过度自定义滚动条、边框或阴影。

## 主题

- 夜间模式通过 `html.dark` 切换。
- 主色通过 `html[data-primary]` 切换。
- 修改颜色时必须同时检查浅色模式和夜间模式下的对比度。

## 代码风格

- 使用函数组件和 React Hooks，不要引入 class 组件。
- 保持 TypeScript 类型完整，优先复用现有接口。
- 避免无用状态、重复样式和一次性组件复制粘贴。
- 文案、注释和 UI 文本保持中文风格一致。
- 不用考虑历史代码的兼容性。
