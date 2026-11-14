import React from 'react'
import ReactDOM from 'react-dom/client'
import {HashRouter, Navigate, Outlet, Route, Routes, useLocation} from 'react-router-dom'
import './index.css'
import {AppTheme} from '@/theme/AppTheme'
import {initializeDarkMode} from '@/lib/useDarkMode'

import Login from '@/pages/Login'
import AppManagement from '@/pages/AppManagement'
import AppSettings from '@/pages/AppSettings'
import AppHome from '@/pages/AppHome'
import AppMenuPage from '@/pages/AppMenuPage'
import AppRecordView from '@/pages/AppRecordView'
import MenuPlaceholder from '@/pages/MenuPlaceholder'
import ApprovalHome from '@/pages/ApprovalHome'
import FeedsHome from '@/pages/FeedsHome'
import FilesDocs from '@/pages/FilesDocs'
import Notifications from '@/pages/Notifications'
import ProjectTasks from '@/pages/ProjectTasks'
import ContactsHome from '@/pages/ContactsHome'
import UserSettings from '@/pages/UserSettings'
import FormDesign from '@/pages/FormDesign'
import FormSettings from '@/pages/FormSettings'
import FormDataPermissions from '@/pages/FormDataPermissions'
import AiChatPage from '@/pages/AiChatPage'
import {AdminApprovals, AdminRoles, AdminUsers,} from '@/pages/admin'
import {MessageViewport} from '@/components/ui/message'
import {AppLoading} from '@/components/biz/AppLoading'
import {getAuthSession} from '@/services/auth'
import {NotificationProvider} from '@/components/notifications/NotificationProvider'
import {AiProvider, useAiAssistant} from '@/components/ai/AiProvider'
import {AiAssistantPanel} from '@/components/ai/AiAssistantPanel'

const ApprovalDesigner = React.lazy(() => import('@/pages/Workflows/WorkflowDesigner'))

function ApprovalDesignerRoute() {
  const current = useLocation()
  return <React.Suspense
    fallback={<AppLoading className="h-screen bg-background" label="正在加载流程设计器"/>}><ApprovalDesigner
    key={current.pathname}/></React.Suspense>
}

// 全局刷新只重建业务页面，外层 AI 会话和侧栏继续保留。
function AppPage() {
  const {refreshVersion} = useAiAssistant()
  return <React.Fragment key={refreshVersion}><Outlet/></React.Fragment>
}

function RequireAuth() {
  const location = useLocation()
  if (!getAuthSession()) {
    return <Navigate to="/login" replace state={{from: location.pathname + location.search}}/>
  }
  return <NotificationProvider>
    <AiProvider>
      <AppPage/>
      <AiAssistantPanel/>
    </AiProvider>
  </NotificationProvider>
}

initializeDarkMode()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MessageViewport/>
    <HashRouter>
      <AppTheme>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/apps" replace/>}/>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth/>}>
          <Route path="/settings/user" element={<UserSettings/>}/>
          {/* 业务对象 */}
          <Route path="/apps/:appId" element={<AppHome/>}/>
          <Route path="/apps/:appId/ai/chat/:robotId" element={<AiChatPage/>}/>
          <Route path="/apps/:appId/:navId" element={<AppMenuPage/>}/>
          <Route path="/apps/:appId/:navId/view/:recordId" element={<AppRecordView/>}/>
          <Route path="/menu/:menuId" element={<MenuPlaceholder/>}/>
          <Route path="/admin/apps" element={<AppManagement/>}/>
          <Route path="/admin/apps/:appId/settings/basic" element={<AppSettings section="basic"/>}/>
          <Route path="/admin/apps/:appId/settings/menus" element={<AppSettings section="menus"/>}/>
          <Route path="/admin/apps/:appId/settings/forms"
                 element={<AppSettings section="forms"/>}/>
          <Route path="/admin/apps/:appId/settings/workflows" element={<AppSettings section="workflows"/>}/>
          <Route path="/admin/apps/:appId/workflow/:flowId/design" element={<ApprovalDesignerRoute/>}/>
          {/* 内置模块 */}
          <Route path="/approval/home" element={<ApprovalHome/>}/>
          <Route path="/feeds/home" element={<FeedsHome/>}/>
          <Route path="/files/home" element={<FilesDocs/>}/>
          <Route path="/notifications" element={<Notifications/>}/>
          <Route path="/notifications/todo" element={<Navigate to="/approval/home" replace/>}/>
          <Route path="/project/:projectId/tasks" element={<ProjectTasks/>}/>
          <Route path="/contacts/home" element={<ContactsHome/>}/>
          {/* 管理中心 */}
          <Route path="/admin/apps/:appId/forms/:formName/base"
                 element={<FormSettings section="base"/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/flows" element={<FormSettings section="flows"/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/data-permissions" element={<FormDataPermissions/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/form-design"
                 element={<FormDesign/>}/>
          <Route path="/admin/users" element={<AdminUsers/>}/>
          <Route path="/admin/role-privileges" element={<AdminRoles/>}/>
          <Route path="/admin/robot/approvals" element={<AdminApprovals/>}/>
        </Route>
        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/admin/apps" replace/>}/>
      </Routes>
      </AppTheme>
    </HashRouter>
  </React.StrictMode>
)
