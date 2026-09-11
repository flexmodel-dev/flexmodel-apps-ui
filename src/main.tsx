import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import Login from '@/pages/Login'
import DashboardHome from '@/pages/DashboardHome'
import RecordList from '@/pages/RecordList'
import RecordView from '@/pages/RecordView'
import ApprovalHome from '@/pages/ApprovalHome'
import FeedsHome from '@/pages/FeedsHome'
import FilesDocs from '@/pages/FilesDocs'
import Notifications from '@/pages/Notifications'
import ProjectTasks from '@/pages/ProjectTasks'
import ContactsHome from '@/pages/ContactsHome'
import FormDesign from '@/pages/FormDesign'
import {
  AdminSystems,
  AdminEntities,
  AdminUsers,
  AdminRoles,
  AdminTeams,
  AdminApprovals,
  AdminTriggers,
  AdminProjects,
  AdminLoginLogs,
  AdminRecycleBin,
} from '@/pages/admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/home" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/home" element={<DashboardHome />} />
        {/* 业务实体 */}
        <Route path="/app/:entity/list" element={<RecordList />} />
        <Route path="/app/:entity/view/:id" element={<RecordView />} />
        {/* 内置模块 */}
        <Route path="/approval/home" element={<ApprovalHome />} />
        <Route path="/feeds/home" element={<FeedsHome />} />
        <Route path="/files/home" element={<FilesDocs />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notifications/todo" element={<Notifications />} />
        <Route path="/project/:projectId/tasks" element={<ProjectTasks />} />
        <Route path="/contacts/home" element={<ContactsHome />} />
        {/* 管理中心 */}
        <Route path="/admin/systems" element={<AdminSystems />} />
        <Route path="/admin/entities" element={<AdminEntities />} />
        <Route path="/admin/entity/:entity/form-design" element={<FormDesign />} />
        <Route path="/admin/bizuser/users" element={<AdminUsers />} />
        <Route path="/admin/bizuser/role-privileges" element={<AdminRoles />} />
        <Route path="/admin/bizuser/teams" element={<AdminTeams />} />
        <Route path="/admin/robot/approvals" element={<AdminApprovals />} />
        <Route path="/admin/robot/triggers" element={<AdminTriggers />} />
        <Route path="/admin/projects" element={<AdminProjects />} />
        <Route path="/admin/audit/login-logs" element={<AdminLoginLogs />} />
        <Route path="/admin/audit/recycle-bin" element={<AdminRecycleBin />} />
        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
