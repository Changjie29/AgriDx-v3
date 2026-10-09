import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { Menu, X, MessageSquare, Sun, Moon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiquidGlass } from '@sohumsuthar/liquid-glass';
import { cn } from '@/lib/utils';
import { useLang, setLang } from '@/hooks/useLang';

const NAV_ZH = [
  { label: '首页', path: '/' },
  { label: '农机知识', path: '/knowledge' },
  { label: '模型工坊', path: '/models' },
  { label: '研究依据', hash: 'research' },
];
const NAV_EN = [
  { label: 'Home', path: '/' },
  { label: 'Knowledge', path: '/knowledge' },
  { label: 'Model studio', path: '/models' },
  { label: 'Research', hash: 'research' },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('srt-theme');
    if (saved === 'dark') return 'dark';
    if (saved === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const lang = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    // 液态玻璃库使用 html.dark 切换暗色材质
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('srt-theme', theme);
  }, [theme]);

  const NAV_ITEMS = lang === 'zh' ? NAV_ZH : NAV_EN;
  const chatLabel = lang === 'zh' ? '诊断工作台' : 'Diagnosis';

  const handleHashNav = (hash: string) => {
    setMobileOpen(false);
    if (location.pathname === '/') {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // 非首页：先回首页，再由 HomePage 按 state.scrollTo 滚动到对应区块。
      // 不用 `/#${hash}` 锚点写法，避免与 HashRouter 的路由 hash 冲突。
      navigate('/', { state: { scrollTo: hash } });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a className="skip-link" href="#main-content">{lang === 'zh' ? '跳到主要内容' : 'Skip to content'}</a>
      {/* 顶部导航栏 */}
      <header className="site-header sticky top-0 z-50 w-full">
        <LiquidGlass
          variant="regular"
          interactive
          lens
          lensOptions={{ bezel: 7, refraction: 0.32, dispersion: 0.8 }}
          className="site-nav-glass"
          contentClassName="flex min-h-16 w-full items-center justify-between gap-2 px-3 md:px-5"
        >
          {/* Logo */}
          <div className="brand-lockup flex items-center gap-3">
            <a href="https://coe.njau.edu.cn/xygk/yh.htm" target="_blank" rel="noreferrer" className="college-mark" aria-label={lang === 'zh' ? '南京农业大学工学院官方院徽' : 'Official College of Engineering emblem, NAU'}>
              <img src="/images/njau-engineering-mark.jpg" alt={lang === 'zh' ? '南京农业大学工学院院徽' : 'College of Engineering, NAU emblem'} width="857" height="411" />
            </a>
            <NavLink to="/" className="brand-wordmark" aria-label={lang === 'zh' ? '耕知·耘诊首页' : 'Gengzhi · Yunzhen home'}><strong>耕知·耘诊</strong><span>{lang === 'zh' ? '农机诊断工作台' : 'Machinery diagnosis'}</span></NavLink>
          </div>

          {/* 桌面端导航 */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_ITEMS.map((item) =>
              item.hash ? (
                <button
                  key={item.hash}
                  onClick={() => handleHashNav(item.hash!)}
                  className="group relative text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 h-0.5 w-0 rounded-full bg-primary transition-all duration-300 group-hover:w-full" />
                </button>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path!}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group relative text-sm transition-colors hover:text-primary',
                      isActive ? 'text-primary font-semibold' : 'text-muted-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      <span
                        className={cn(
                          'absolute -bottom-1 left-0 h-0.5 rounded-full bg-primary transition-all duration-300',
                          isActive ? 'w-full' : 'w-0 group-hover:w-full',
                        )}
                      />
                    </>
                  )}
                </NavLink>
              ),
            )}
            <Button asChild size="sm" className="gap-1.5">
              <NavLink to="/chat">
                <MessageSquare className="h-4 w-4" />
                {chatLabel}
              </NavLink>
            </Button>
          </nav>

          {/* 右侧工具按钮（主题 + 语言 + 移动端菜单） */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-all hover:bg-accent hover:text-primary hover:scale-105"
              aria-label="切换主题"
              title={theme === 'dark' ? '切到亮色' : '切到暗色'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-primary hover:scale-105"
              aria-label="切换语言"
            >
              <Globe className="h-4 w-4" />
              {lang === 'zh' ? 'EN' : '中'}
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="菜单"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </LiquidGlass>

        {/* 移动端导航抽屉（非玻璃，避免玻璃嵌套失效） */}
        {mobileOpen && (
          <div id="mobile-navigation" className="mt-2 rounded-2xl border border-border/60 bg-card/90 shadow-lg backdrop-blur-xl lg:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              {NAV_ITEMS.map((item) =>
                item.hash ? (
                  <button
                    key={item.hash}
                    onClick={() => handleHashNav(item.hash!)}
                    className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-primary"
                  >
                    {item.label}
                  </button>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path!}
                    end={item.path === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-accent text-primary font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-primary',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ),
              )}
              <Button asChild size="sm" className="mt-2 gap-1.5">
                <NavLink to="/chat" onClick={() => setMobileOpen(false)}>
                  <MessageSquare className="h-4 w-4" />
                  {chatLabel}
                </NavLink>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* 主内容区 */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}
