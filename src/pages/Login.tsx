import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RbDialog } from '@/components/ui/dialog'
import { Globe, Smartphone } from 'lucide-react'

/** 用户登录页（复刻 signup/login.html） */
export default function Login() {
  const navigate = useNavigate()
  const [user, setUser] = React.useState('admin')
  const [passwd, setPasswd] = React.useState('admin')
  const [remember, setRemember] = React.useState(true)
  const [showMobile, setShowMobile] = React.useState(false)
  const [langOpen, setLangOpen] = React.useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/dashboard/home')
  }

  return (
    <div className="rb-login-page relative min-h-screen">
      <div
        className="rb-bgimg fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: 'url(/bg.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="relative z-[2] flex min-h-screen items-start justify-center">
        <div className="w-full max-w-[421px] px-4 pt-[50px]">
          <div className="mb-[30px] rounded-xl border bg-card shadow-md">
            <div className="mb-[20px] border-b border-[#e6e6e6] px-4 pb-0 pt-[40px] text-center">
              <a className="logo-img mx-auto block h-[30px] w-[150px] bg-[url('/logo.png')] bg-auto bg-center bg-no-repeat" />
            </div>
            <div className="px-[30px] pb-[15px] pt-5">
              <form id="login-form" onSubmit={submit}>
                <div className="form-group mb-3">
                  <Input
                    id="user"
                    placeholder="用户名 (或邮箱)"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="h-[41px]"
                  />
                </div>
                <div className="form-group mb-3">
                  <Input
                    id="passwd"
                    type="password"
                    placeholder="密码"
                    value={passwd}
                    onChange={(e) => setPasswd(e.target.value)}
                    className="h-[41px]"
                  />
                </div>
                <div className="mb-3 mt-2.5 flex items-center pt-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#555]">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} id="autoLogin" />
                    记住登录
                  </label>
                  <a className="ml-auto text-sm text-primary hover:underline" onClick={(e) => e.preventDefault()}>
                    找回密码
                  </a>
                </div>
                <div className="mb-[18px] pt-[19px]">
                  <Button type="submit" className="h-11 w-full text-base font-medium">
                    登录
                  </Button>
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    还没有账号?{' '}
                    <a className="text-primary hover:underline" onClick={(e) => e.preventDefault()}>
                      立即注册
                    </a>
                  </div>
                </div>

                <div className="login-with relative mt-[25px] hidden border-t border-[#ebebeb] pt-[25px] md:block">
                  <span className="absolute left-1/2 top-[-9px] -ml-[44px] w-[88px] bg-card text-center text-sm text-muted-foreground">
                    第三方登录
                  </span>
                  <div className="flex items-center justify-center gap-4">
                    <a title="钉钉" onClick={(e) => e.preventDefault()}>
                      <img
                        src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNiIgZmlsbD0iIzAwOGQ4MSIvPjx0ZXh0IHg9IjE2IiB5PSIyMiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5qGNPC90ZXh0Pjwvc3ZnPg=="
                        alt="钉钉"
                        className="h-8 w-8 rounded-md bg-muted"
                      />
                    </a>
                    <a title="企业微信" onClick={(e) => e.preventDefault()}>
                      <img
                        src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNiIgZmlsbD0iIzAwOGQ4MSIvPjx0ZXh0IHg9IjE2IiB5PSIyMiIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+V1hHPC90ZXh0Pjwvc3ZnPg=="
                        alt="企业微信"
                        className="h-8 w-8 rounded-md bg-muted"
                      />
                    </a>
                    <a title="飞书" onClick={(e) => e.preventDefault()}>
                      <img
                        src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNiIgZmlsbD0iIzMzZGVlMCIvPjx0ZXh0IHg9IjE2IiB5PSIyMiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5ZyfPC90ZXh0Pjwvc3ZnPg=="
                        alt="飞书"
                        className="h-8 w-8 rounded-md bg-muted"
                      />
                    </a>
                  </div>
                </div>

                <div className="mb-2 mt-5 flex items-center">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[13px] text-[#404040]"
                    onClick={() => setShowMobile(true)}
                  >
                    <span className="flex h-[25px] w-[25px] items-center justify-center rounded-full bg-[#fc9a00] text-white">
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <span className="mt-[3px]">手机版</span>
                  </button>
                  <div className="relative ml-auto">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[13px] text-[#404040]"
                      onClick={() => setLangOpen((o) => !o)}
                    >
                      <Globe className="h-4 w-4" />
                      <span>中文</span>
                    </button>
                    {langOpen && (
                      <div className="rb-dropdown-content absolute right-0 top-full mt-1 w-[100px]">
                        <a className="rb-dropdown-item block" onClick={() => setLangOpen(false)}>中文</a>
                        <a className="rb-dropdown-item block" onClick={() => setLangOpen(false)}>繁体</a>
                        <a className="rb-dropdown-item block" onClick={() => setLangOpen(false)}>English</a>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
          <div className="splash-footer mt-4 text-center">
            <div className="copyright text-[13px] text-white/90" style={{ textShadow: '0 1px 1px #555' }}>
              © newbuild
            </div>
          </div>
        </div>
      </div>

      {/* 手机版二维码弹层 */}
      <RbDialog open={showMobile} onOpenChange={setShowMobile} title="手机版" width={320}>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="flex h-[180px] w-[180px] items-center justify-center rounded border bg-muted text-muted-foreground">
            <Smartphone className="h-14 w-14" />
          </div>
          <div className="text-sm text-muted-foreground">使用手机浏览器扫描二维码访问</div>
        </div>
      </RbDialog>
    </div>
  )
}
