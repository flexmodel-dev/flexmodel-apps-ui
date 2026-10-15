import React from 'react'
import ReactDOM from 'react-dom/client'
import {HashRouter, Routes, Route, Navigate, Outlet, useLocation} from 'react-router-dom'
import './index.css'

import Login from '@/pages/Login'
import AppManagement from '@/pages/AppManagement'
import AppSettings from '@/pages/AppSettings'
import AppHome from '@/pages/AppHome'
import AppMenuPage from '@/pages/AppMenuPage'
import AppRecordView from '@/pages/AppRecordView'
import RecordList from '@/pages/RecordList'
import RecordView from '@/pages/RecordView'
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
import {
  AdminUsers,
  AdminRoles,
  AdminApprovals,
  AdminTriggers,
} from '@/pages/admin'
import {getAuthSession} from '@/services/auth'

function RequireAuth() {
  const location = useLocation()
  if (!getAuthSession()) {
    return <Navigate to="/login" replace state={{from: location.pathname}}/>
  }
  return <Outlet/>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/apps" replace/>}/>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth/>}>
          <Route path="/settings/user" element={<UserSettings/>}/>
          {/* 业务对象 */}
          <Route path="/apps/:appId" element={<AppHome/>}/>
          <Route path="/apps/:appId/:menuId" element={<AppMenuPage/>}/>
          <Route path="/apps/:appId/:menuId/view/:recordId" element={<AppRecordView/>}/>
          <Route path="/menu/:menuId" element={<MenuPlaceholder/>}/>
          <Route path="/admin/apps" element={<AppManagement/>}/>
          <Route path="/admin/apps/:appId/settings/basic" element={<AppSettings section="basic"/>}/>
          <Route path="/admin/apps/:appId/settings/menus" element={<AppSettings section="menus"/>}/>
          <Route path="/admin/apps/:appId/settings/forms"
                 element={<AppSettings section="forms"/>}/>
          <Route path="/admin/apps/:appId/settings/approvals" element={<AppSettings section="approvals"/>}/>
          <Route path="/admin/apps/:appId/settings/triggers" element={<AppSettings section="triggers"/>}/>
          {/* 内置模块 */}
          <Route path="/approval/home" element={<ApprovalHome/>}/>
          <Route path="/feeds/home" element={<FeedsHome/>}/>
          <Route path="/files/home" element={<FilesDocs/>}/>
          <Route path="/notifications" element={<Notifications/>}/>
          <Route path="/notifications/todo" element={<Notifications/>}/>
          <Route path="/project/:projectId/tasks" element={<ProjectTasks/>}/>
          <Route path="/contacts/home" element={<ContactsHome/>}/>
          {/* 管理中心 */}
          <Route path="/admin/apps/:appId/forms/:formName/base"
                 element={<FormSettings section="base"/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/fields"
                 element={<FormSettings section="fields"/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/form-design"
                 element={<FormDesign/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/easy-action"
                 element={<FormSettings section="easy-action"/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/record-alerts"
                 element={<FormSettings section="record-alerts"/>}/>
          <Route path="/admin/apps/:appId/forms/:formName/advanced"
                 element={<FormSettings section="advanced"/>}/>
          <Route path="/admin/users" element={<AdminUsers/>}/>
          <Route path="/admin/role-privileges" element={<AdminRoles/>}/>
          <Route path="/admin/robot/approvals" element={<AdminApprovals/>}/>
          <Route path="/admin/robot/triggers" element={<AdminTriggers/>}/>
        </Route>
        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/admin/apps" replace/>}/>
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
