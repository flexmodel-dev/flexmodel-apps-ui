import * as React from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Moon,
  Sun,
  UserRound
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {useDarkMode} from '@/lib/useDarkMode'
import {login} from '@/services/auth'
import {toErrorMessage} from '@/lib/utils'
import {LoginIllustration} from './LoginIllustration'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDark, setIsDark] = useDarkMode()
  const [user, setUser] = React.useState('')
  const [passwd, setPasswd] = React.useState('')
  const [remember, setRemember] = React.useState(true)
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const submitting = React.useRef(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    setError('')
    if (!user.trim()) {
      setError('请输入用户名或邮箱')
      return
    }
    submitting.current = true
    setLoading(true)
    try {
      await login(user.trim(), passwd, remember)
      const requestedFrom = (location.state as { from?: string } | null)?.from
      const from = requestedFrom && requestedFrom !== '/workbench/home' ? requestedFrom : '/admin/apps'
      navigate(from, {replace: true})
    } catch (err) {
      setError(toErrorMessage(err, '登录失败，请稍后重试'))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <div className="apps-login h-dvh overflow-y-auto bg-background text-foreground">
      <div className="flex min-h-full flex-col">
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-6 sm:px-10 lg:px-12">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">F</span>
            <span className="text-base font-semibold tracking-tight">Flexmodel <span
              className="font-normal text-muted-foreground">Apps</span></span>
          </div>
          <Button variant="ghost" size="icon" aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
                  title={isDark ? '切换到浅色模式' : '切换到深色模式'} onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
          </Button>
        </header>

        <main
          className="login-stage mx-auto my-auto grid w-full max-w-[1180px] items-center gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-12 lg:py-12">
          <section className="login-story hidden min-w-0 lg:block" aria-labelledby="login-intro">
            <div
              className="mb-5 inline-flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"/>灵感，正在发生
            </div>
            <h1 id="login-intro" className="text-4xl font-semibold leading-[1.45] tracking-tight xl:text-[42px]">
              每一个好想法，<br/>都值得<span className="text-primary">成为应用。</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              连接数据、流程与团队。<br/>用更轻盈的方式，构建属于你的业务空间。
            </p>
            <LoginIllustration/>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5"/><span>数据表单</span><span
              className="h-1 w-1 rounded-full bg-border"/>
              <span>流程协作</span><span className="h-1 w-1 rounded-full bg-border"/><span>团队工作台</span>
            </div>
          </section>

          <section aria-labelledby="login-title"
                   className="login-form-panel mx-auto w-full max-w-[400px] rounded-2xl border bg-card p-6 sm:p-8 lg:p-9">
            <div className="mb-8">
              <span
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border bg-background text-primary"><LockKeyhole
                className="h-5 w-5"/></span>
              <h2 id="login-title" className="text-2xl font-semibold tracking-tight">欢迎回来</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">登录 Flexmodel Apps，继续你的工作。</p>
            </div>

            <form id="login-form" onSubmit={submit} className="space-y-5" aria-busy={loading}>
              <div className="space-y-2.5">
                <Label htmlFor="user">用户名或邮箱</Label>
                <div className="relative">
                  <UserRound aria-hidden="true"
                             className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/>
                  <Input id="user" name="username" placeholder="请输入用户名或邮箱" value={user}
                         onChange={(e) => setUser(e.target.value)} autoComplete="username" required
                         disabled={loading} className="h-11 pl-10"/>
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="passwd">密码</Label>
                <div className="relative">
                  <LockKeyhole aria-hidden="true"
                               className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/>
                  <Input id="passwd" name="password" type={showPassword ? 'text' : 'password'} placeholder="请输入密码"
                         value={passwd} onChange={(e) => setPasswd(e.target.value)} autoComplete="current-password"
                         required disabled={loading} className="h-11 pl-10 pr-12"/>
                  <Button type="button" variant="ghost" size="icon"
                          className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                          aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="autoLogin" checked={remember} onCheckedChange={(v) => setRemember(v === true)}
                          disabled={loading}/>
                <Label htmlFor="autoLogin"
                       className="cursor-pointer text-sm font-normal text-muted-foreground">记住登录</Label>
              </div>
              {error && (
                <div role="alert"
                     className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span>
                </div>
              )}
              <Button type="submit" disabled={loading} className="group h-11 w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin"/>正在登录…</> : <>登录<ArrowRight
                  className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1"/></>}
              </Button>
            </form>
            <p
              className="mt-7 border-t pt-5 text-center text-xs leading-6 text-muted-foreground">账号由管理员分配，如需帮助请联系管理员。</p>
          </section>
        </main>

        <footer
          className="shrink-0 px-6 py-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Flexmodel
          Apps
        </footer>
      </div>
    </div>
  )
}
