import * as React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { contactsList } from '@/data/mock'
import { Plus } from 'lucide-react'

/** 通讯录 */
export default function ContactsHome() {
  const [q, setQ] = React.useState('')
  const list = contactsList.filter((c) => !q || c.name.includes(q) || c.contact.includes(q))

  return (
    <AppLayout>
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h4 className="m-0 text-base font-medium">通讯录</h4>
          <div className="flex items-center gap-2">
            <input
              className="h-10 w-[220px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="搜索客户联系人"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button><Plus className="h-4 w-4" /> 新建联系人</Button>
          </div>
        </div>
        <div className="rb-table-scroll overflow-x-auto p-4">
          <table className="rb-table w-full min-w-[700px]">
            <thead>
              <tr>
                <th>客户名称</th>
                <th>联系人</th>
                <th>电话</th>
                <th>邮箱</th>
                <th>所属用户</th>
                <th className="w-[100px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.contact}</td>
                  <td className="text-primary">{c.phone}</td>
                  <td className="text-primary">{c.email}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <UserAvatar name={c.owner} size={20} />
                      {c.owner}
                    </span>
                  </td>
                  <td>
                    <Button variant="secondary" size="sm" className="!h-8 !px-3">查看</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">暂无联系人</div>}
        </div>
      </div>
    </AppLayout>
  )
}
