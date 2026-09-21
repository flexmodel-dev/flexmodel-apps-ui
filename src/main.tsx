import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import Login from '@/pages/Login'
import DashboardHome from '@/pages/DashboardHome'
import AppManagement from '@/pages/AppManagement'
import AppSettings from '@/pages/AppSettings'
import RecordList from '@/pages/RecordList'
import RecordView from '@/pages/RecordView'
import ApprovalHome from '@/pages/ApprovalHome'
import FeedsHome from '@/pages/FeedsHome'
import FilesDocs from '@/pages/FilesDocs'
import Notifications from '@/pages/Notifications'
import ProjectTasks from '@/pages/ProjectTasks'
import ContactsHome from '@/pages/ContactsHome'
import UserSettings from '@/pages/UserSettings'
import FormDesign from '@/pages/FormDesign'
import {
  AdminEntities,
  AdminUsers,
  AdminRoles,
  AdminTeams,
  AdminApprovals,
  AdminTriggers,
} from '@/pages/admin'
import { getAppById, getAppMenus } from '@/data/mock'

function AppHomeRedirect() {
  const { appId } = { appId: window.location.hash.split('/')[2] }
  const firstMenu = getAppMenus(appId)[0]
  return getAppById(appId) && firstMenu
    ? <Navigate to={`/app/${appId}/${firstMenu.id}`} replace />
    : <Navigate to="/dashboard/home" replace />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/home" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/settings/user" element={<UserSettings />} />
        <Route path="/dashboard/home" element={<DashboardHome />} />
        {/* 业务对象 */}
        <Route path="/app/:appId" element={<AppHomeRedirect />} />
        <Route path="/app/:appId/:menuId" element={<RecordList />} />
        <Route path="/app/:appId/:menuId/view/:recordId" element={<RecordView />} />
        <Route path="/admin/apps" element={<AppManagement />} />
        <Route path="/admin/apps/:appId/settings/basic" element={<AppSettings section="basic" />} />
        <Route path="/admin/apps/:appId/settings/entities" element={<AppSettings section="entities" />} />
        <Route path="/admin/apps/:appId/settings/approvals" element={<AppSettings section="approvals" />} />
        <Route path="/admin/apps/:appId/settings/triggers" element={<AppSettings section="triggers" />} />
        {/* 内置模块 */}
        <Route path="/approval/home" element={<ApprovalHome />} />
        <Route path="/feeds/home" element={<FeedsHome />} />
        <Route path="/files/home" element={<FilesDocs />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notifications/todo" element={<Notifications />} />
        <Route path="/project/:projectId/tasks" element={<ProjectTasks />} />
        <Route path="/contacts/home" element={<ContactsHome />} />
        {/* 管理中心 */}
        <Route path="/admin/entities" element={<AdminEntities />} />
        <Route path="/admin/entity/:entity/form-design" element={<FormDesign />} />
        <Route path="/admin/bizuser/users" element={<AdminUsers />} />
        <Route path="/admin/bizuser/role-privileges" element={<AdminRoles />} />
        <Route path="/admin/bizuser/teams" element={<AdminTeams />} />
        <Route path="/admin/robot/approvals" element={<AdminApprovals />} />
        <Route path="/admin/robot/triggers" element={<AdminTriggers />} />
        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
