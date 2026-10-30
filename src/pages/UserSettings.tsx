import * as React from 'react'
import {Camera, Check, KeyRound, Mail, ShieldCheck, Timer, UserRound} from 'lucide-react'
import {AppLayout} from '@/components/layout/AppLayout'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {AppLoading} from '@/components/biz/AppLoading'
import {UserAvatar} from '@/components/ui/avatar'
import {getAuthSession, updateAuthUser} from '@/services/auth'
import {
  getCurrentProfile,
  getLoginLogs,
  type LoginLogEntry,
  updateCurrentProfile,
  uploadUserAvatar,
  type UserProfile,
} from '@/services/profile'
import {loadAttachment} from '@/services/attachments'
import {toErrorMessage} from '@/lib/utils'

type SecurityRow = {
  key: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  description: string
  action?: 'edit' | 'revoke' | 'get'
  actionLabel?: string
}

function SettingRow({
                      label,
                      children,
                      action,
                    }: {
  label: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 border-b border-dashed py-4 last:border-b-0 md:grid-cols-4">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="min-w-0 md:col-span-3 md:flex md:items-center md:justify-end md:gap-3">{children}</div>
    </div>
  )
}

export default function UserSettings() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
  const [fullName, setFullName] = React.useState('')
  const [workphone, setWorkphone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [error, setError] = React.useState('')
  const [emailOpen, setEmailOpen] = React.useState(false)
  const [passwordOpen, setPasswordOpen] = React.useState(false)
  const [tempAuthOpen, setTempAuthOpen] = React.useState(false)
  const [tempAuthUrl, setTempAuthUrl] = React.useState('')
  const [accessKeyOpen, setAccessKeyOpen] = React.useState(false)
  const [accessKey, setAccessKey] = React.useState('')
  const [newEmail, setNewEmail] = React.useState('')
  const [emailCode, setEmailCode] = React.useState('')
  const [oldPassword, setOldPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [repeatPassword, setRepeatPassword] = React.useState('')
  const [providerMessage, setProviderMessage] = React.useState('')
  const [loginLogs, setLoginLogs] = React.useState<LoginLogEntry[]>([])
  const [logsLoading, setLogsLoading] = React.useState(true)
  const [logsError, setLogsError] = React.useState('')
  const avatarInputRef = React.useRef<HTMLInputElement>(null)
  const sessionUser = getAuthSession()?.user
  const mainDepartment = profile?.departments.find((department) => department.isMain) ?? profile?.departments[0]

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCurrentProfile()
      .then((loaded) => {
        if (cancelled) return
        setProfile(loaded)
        setFullName(loaded.name)
        setEmail(loaded.email)
        setWorkphone(loaded.phone)
        setAvatarUrl(loaded.avatar)
      })
      .catch((caught) => {
        if (!cancelled) setError(toErrorMessage(caught, '加载个人信息失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    setLogsLoading(true)
    setLogsError('')
    getLoginLogs()
      .then((logs) => {
        if (!cancelled) setLoginLogs(logs)
      })
      .catch((caught) => {
        if (!cancelled) setLogsError(toErrorMessage(caught, '加载登录日志失败'))
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!avatarUrl) {
      setAvatarPreview(null)
      return
    }
    if (/^(https?:)?\/\//i.test(avatarUrl) || avatarUrl.startsWith('data:')) {
      setAvatarPreview(avatarUrl)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    loadAttachment(avatarUrl)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setAvatarPreview(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setAvatarPreview(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [avatarUrl])

  const securityRows: SecurityRow[] = [
    {key: 'email', icon: Mail, label: '修改邮箱', value: email, description: '', action: 'edit', actionLabel: '修改'},
    {
      key: 'password',
      icon: ShieldCheck,
      label: '修改密码',
      description: '建议 90 天更改一次密码',
      action: 'edit',
      actionLabel: '修改'
    },
    {key: 'dingtalk', icon: Timer, label: '钉钉授权', value: email, description: '已授权', action: 'revoke'},
    {
      key: 'wxwork',
      icon: UserRound,
      label: '企业微信授权',
      value: profile?.name ?? '',
      description: '已授权',
      action: 'revoke'
    },
    {
      key: 'feishu',
      icon: Timer,
      label: '飞书授权',
      value: profile?.name ?? '',
      description: '已授权',
      action: 'revoke'
    },
    {
      key: 'temp-auth',
      icon: Timer,
      label: '临时授权',
      description: '临时授权管理员或其他可信人员登录你的账号',
      action: 'get',
      actionLabel: '获取'
    },
    {
      key: 'ak',
      icon: KeyRound,
      label: '个人秘钥 (AK)',
      description: '可用于外部工具连接授权',
      action: 'get',
      actionLabel: '获取'
    },
  ]

  const closeDialogs = () => {
    setEmailOpen(false)
    setPasswordOpen(false)
    setTempAuthOpen(false)
    setAccessKeyOpen(false)
  }

  const showProviderMessage = (message: string) => {
    setProviderMessage(message)
    window.setTimeout(() => setProviderMessage(''), 1800)
  }

  const selectAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const userId = profile?.id ?? sessionUser?.id
    if (!userId) return
    setUploadingAvatar(true)
    setError('')
    try {
      setAvatarUrl(await uploadUserAvatar(userId, file))
    } catch (caught) {
      setError(toErrorMessage(caught, '头像上传失败'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveProfile = async () => {
    const name = fullName.trim()
    if (!name) {
      setError('姓名不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateCurrentProfile({name, phone: workphone.trim(), avatar: avatarUrl})
      setProfile(updated)
      setFullName(updated.name)
      setWorkphone(updated.phone)
      setEmail(updated.email)
      setAvatarUrl(updated.avatar)
      updateAuthUser({name: updated.name, email: updated.email, avatar: updated.avatar})
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1600)
    } catch (caught) {
      setError(toErrorMessage(caught, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const submitEmail = () => {
    if (!newEmail.trim() || !emailCode.trim()) return
    setEmail(newEmail.trim())
    setNewEmail('')
    setEmailCode('')
    closeDialogs()
  }

  const submitPassword = () => {
    if (!oldPassword.trim() || !newPassword.trim() || newPassword !== repeatPassword) return
    setOldPassword('')
    setNewPassword('')
    setRepeatPassword('')
    closeDialogs()
  }

  const createTempAuth = () => {
    const userId = profile?.id ?? sessionUser?.id
    if (!userId) return
    setTempAuthUrl(`https://flexmodel-apps.local/temp-auth/${userId}-${Date.now().toString(36)}`)
    setTempAuthOpen(true)
  }

  const createAccessKey = () => {
    const userId = profile?.id ?? sessionUser?.id
    if (!userId) return
    setAccessKey(`ak-${userId}-${Date.now().toString(36)}`)
    setAccessKeyOpen(true)
  }

  return (
    <AppLayout hideNavigation showBack>
      <div className="mx-auto w-full max-w-[960px]">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-4 md:p-6">
            <Tabs defaultValue="base">
              <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
                <TabsTrigger
                  value="base"
                  className="h-10 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  个人信息
                </TabsTrigger>
                {/*<TabsTrigger
                  value="secure"
                  className="h-10 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  安全设置
                </TabsTrigger>*/}
                <TabsTrigger
                  value="logs"
                  className="h-10 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  登录日志
                </TabsTrigger>
              </TabsList>

              <TabsContent value="base" className="mt-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <div className="flex h-64 items-center justify-center rounded-xl bg-muted/60">
                    <button
                      type="button"
                      className="group relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-card"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={loading || uploadingAvatar}
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="头像" className="h-full w-full object-cover"/>
                      ) : (
                        <UserAvatar name={fullName} size={160}/>
                      )}
                      <span
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-7 w-7"/>
                        修改头像
                      </span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.gif,.png,.bpm"
                      className="hidden"
                      onChange={selectAvatar}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <SettingRow label="用户名">
                      <span className="text-sm text-foreground">{profile?.id || sessionUser?.id || '—'}</span>
                    </SettingRow>
                    <SettingRow label="所属部门">
                      <span className="text-sm text-muted-foreground">{mainDepartment?.departmentName || '—'}</span>
                    </SettingRow>
                    <SettingRow label="姓名">
                      <Input
                        value={fullName}
                        disabled={loading || saving}
                        onChange={(event) => setFullName(event.target.value)}
                      />
                    </SettingRow>
                    <SettingRow label="工作电话">
                      <Input
                        value={workphone}
                        placeholder="无"
                        disabled={loading || saving}
                        onChange={(event) => setWorkphone(event.target.value)}
                      />
                    </SettingRow>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      {error && <span className="text-sm text-destructive">{error}</span>}
                      {saved && (
                        <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4"/>
                          已保存
                        </span>
                      )}
                      <Button onClick={saveProfile} disabled={loading || saving || uploadingAvatar}>确定</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/*<TabsContent value="secure" className="mt-4">
                {providerMessage && (
                  <div className="mb-3 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    {providerMessage}
                  </div>
                )}
                <div className="px-1">
                  {securityRows.map((row) => {
                    const Icon = row.icon
                    return (
                      <SettingRow key={row.key} label={row.label}>
                        <div className="min-w-0 flex-1 text-left">
                          {row.value && <p className="m-0 truncate text-sm text-foreground">{row.value}</p>}
                          {row.description && <p className="m-0 text-sm text-muted-foreground">{row.description}</p>}
                        </div>
                        {row.action === 'edit' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (row.key === 'email' ? setEmailOpen(true) : setPasswordOpen(true))}
                          >
                            {row.actionLabel}
                          </Button>
                        )}
                        {row.action === 'revoke' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => showProviderMessage(`已取消${row.label.replace('授权', '')}授权`)}
                          >
                            取消授权
                          </Button>
                        )}
                        {row.action === 'get' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (row.key === 'temp-auth' ? createTempAuth() : createAccessKey())}
                          >
                            {row.actionLabel}
                          </Button>
                        )}
                      </SettingRow>
                    )
                  })}
                </div>
              </TabsContent>*/}

              <TabsContent value="logs" className="mt-4">
                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="w-14 px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">登录时间</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP 地址</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">客户端</th>
                      </tr>
                      </thead>
                      <tbody>
                      {loginLogs.map((log, index) => (
                        <tr key={log.id} className="border-b last:border-b-0 hover:bg-primary/5">
                          <td className="px-4 py-3 text-muted-foreground">{index + 1}.</td>
                          <td className="px-4 py-3">{log.time}</td>
                          <td className="px-4 py-3">{log.ip}</td>
                          <td className="px-4 py-3">{log.agent}</td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                  {loginLogs.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {logsLoading ?
                        <AppLoading className="p-0" label="正在加载登录日志"/> : logsError || '暂无登录日志'}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/*<BizDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        title="修改邮箱"
        width={460}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEmailOpen(false)}>取消</Button>
            <Button onClick={submitEmail}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">新邮箱</label>
            <Input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">验证码</label>
              <Input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
            </div>
            <Button variant="outline" className="mt-6 w-full" onClick={() => setEmailCode('123456')}>
              获取验证码
            </Button>
          </div>
        </div>
      </BizDialog>*/}

      {/*<BizDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title="修改密码"
        width={460}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordOpen(false)}>取消</Button>
            <Button onClick={submitPassword}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">原密码</label>
            <Input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">新密码</label>
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">重复新密码</label>
            <Input type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} />
          </div>
        </div>
      </BizDialog>*/}

      {/*<BizDialog open={tempAuthOpen} onOpenChange={setTempAuthOpen} title="临时授权" width={520}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={tempAuthUrl} />
            <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(tempAuthUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="m-0 text-sm text-muted-foreground">通过临时授权链接可登录你的账号，请勿向陌生人提供。</p>
        </div>
      </BizDialog>

      <BizDialog open={accessKeyOpen} onOpenChange={setAccessKeyOpen} title="个人秘钥" width={460}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={accessKey} />
            <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(accessKey)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="m-0 text-sm text-muted-foreground">秘钥仅显示一次，请复制保存。</p>
        </div>
      </BizDialog>*/}
    </AppLayout>
  )
}
