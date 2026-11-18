import { CalendarDays, House, LogOut, Refrigerator, ScanLine, ShieldCheck, ShoppingCart, Sun, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useItems, useLogout, useMe, useShopping } from '../api/hooks';
import type { User } from '../api/types';
import { AdminPage } from '../features/admin/AdminPage';
import { LoginPage } from '../features/auth/LoginPage';
import { HouseholdPage } from '../features/household/HouseholdPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { PlannerPage } from '../features/planner/PlannerPage';
import { ReceiptPage } from '../features/receipts/ReceiptPage';
import { ShoppingPage } from '../features/shopping/ShoppingPage';
import { TodayPage } from '../features/today/TodayPage';
import { NavigationContext, SECTIONS, type Section } from './navigation';
import { useLiveSync } from './useLiveSync';

interface NavItem {
  id: Section;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar; the rest are reached from inside the pages. */
  inTabBar: boolean;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { id: 'today', label: 'Hoy', icon: Sun, inTabBar: true },
  { id: 'inventory', label: 'Alimentos', icon: Refrigerator, inTabBar: true },
  { id: 'planner', label: 'Menú', icon: CalendarDays, inTabBar: true },
  { id: 'shopping', label: 'Compra', icon: ShoppingCart, inTabBar: true },
  { id: 'receipt', label: 'Escanear ticket', icon: ScanLine, inTabBar: false },
  { id: 'household', label: 'Mi casa', icon: House, inTabBar: false },
  { id: 'admin', label: 'Administración', icon: ShieldCheck, inTabBar: false, adminOnly: true },
];

export function App() {
  const me = useMe();
  useLiveSync(me.isSuccess && !!me.data);

  if (me.isPending) return <div className="splash" aria-label="Cargando" />;
  if (!me.data) return <LoginPage />;
  return <Shell user={me.data} />;
}

function Shell({ user }: { user: User }) {
  const { username } = user;
  const nav = NAV.filter((item) => !item.adminOnly || user.isAdmin);
  const [requested, setSection] = useState<Section>(sectionFromHash);
  // Someone who is not an admin never lands on the admin section, even from an old link.
  const section = nav.some((item) => item.id === requested) ? requested : 'today';
  const logout = useLogout();
  const alerts = (useItems().data ?? []).filter((item) => item.status !== 'ok').length;
  const toBuy = (useShopping().data ?? []).filter((entry) => !entry.checked).length;
  const badges: Partial<Record<Section, { count: number; alert?: boolean }>> = {
    inventory: { count: alerts, alert: true },
    shopping: { count: toBuy },
  };

  const go = useCallback((next: Section) => {
    setSection(next);
    history.pushState(null, '', `#${next}`);
    window.scrollTo(0, 0);
  }, []);

  // The phone's back button moves between sections instead of leaving the app.
  useEffect(() => {
    const onPop = () => setSection(sectionFromHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const label = NAV.find((item) => item.id === section)?.label;
    document.title = `${label} – Kitchen Storage`;
  }, [section]);

  const badge = (id: Section) => {
    const b = badges[id];
    if (!b?.count) return null;
    return (
      <span className={`nav-badge ${b.alert ? 'nav-badge-alert' : ''}`} aria-label={b.alert ? `${b.count} avisos` : `${b.count} pendientes`}>
        {b.count}
      </span>
    );
  };

  return (
    <NavigationContext.Provider value={go}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <img src="/icon.svg" alt="" width={32} height={32} />
            <span>Kitchen Storage</span>
          </div>
          <nav aria-label="Secciones">
            <ul className="side-nav">
              {nav.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button type="button" className={`side-link ${section === id ? 'side-link-active' : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}>
                    <Icon aria-hidden size={20} />
                    <span>{label}</span>
                    {badge(id)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="sidebar-user">
            <span className="avatar" aria-hidden>
              {username.charAt(0).toLocaleUpperCase('es')}
            </span>
            <span className="sidebar-username">
              {username}
              <span className="sidebar-household">{user.householdName}</span>
            </span>
            <button type="button" className="icon-btn" onClick={() => logout.mutate()} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut aria-hidden size={18} />
            </button>
          </div>
        </aside>

        <main className="content">
          {section === 'today' && <TodayPage username={username} isAdmin={user.isAdmin} />}
          {section === 'inventory' && <InventoryPage />}
          {section === 'planner' && <PlannerPage />}
          {section === 'shopping' && <ShoppingPage />}
          {section === 'receipt' && <ReceiptPage />}
          {section === 'household' && <HouseholdPage />}
          {section === 'admin' && <AdminPage />}
        </main>

        <nav className="tabbar" aria-label="Secciones">
          {NAV.filter((item) => item.inTabBar).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`tab ${section === id ? 'tab-active' : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}>
              <span className="tab-icon">
                <Icon aria-hidden size={22} />
                {badge(id)}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </NavigationContext.Provider>
  );
}

function sectionFromHash(): Section {
  const hash = location.hash.slice(1);
  return SECTIONS.includes(hash as Section) ? (hash as Section) : 'today';
}
