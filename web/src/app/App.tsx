import { useState } from 'react';
import { useItems, useLogout, useMe, useShopping } from '../api/hooks';
import { LoginPage } from '../features/auth/LoginPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { PlannerPage } from '../features/planner/PlannerPage';
import { ReceiptPage } from '../features/receipts/ReceiptPage';
import { ShoppingPage } from '../features/shopping/ShoppingPage';
import { useLiveSync } from './useLiveSync';

type Tab = 'inventory' | 'planner' | 'shopping' | 'receipt';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'inventory', label: 'Kitchen', icon: '🍎' },
  { id: 'planner', label: 'Planner', icon: '📅' },
  { id: 'shopping', label: 'Shopping', icon: '🛒' },
  { id: 'receipt', label: 'Receipt', icon: '🧾' },
];

export function App() {
  const me = useMe();
  useLiveSync(me.isSuccess);

  if (me.isPending) return <p className="muted center">Loading…</p>;
  if (!me.data) return <LoginPage />;
  return <Shell username={me.data.username} />;
}

function Shell({ username }: { username: string }) {
  const [tab, setTab] = useState<Tab>(() => tabFromHash());
  const logout = useLogout();
  const alerts = (useItems().data ?? []).filter((item) => item.status !== 'ok').length;
  const toBuy = (useShopping().data ?? []).filter((entry) => !entry.checked).length;

  const go = (next: Tab) => {
    setTab(next);
    history.replaceState(null, '', `#${next}`);
    window.scrollTo(0, 0);
  };

  const badges: Partial<Record<Tab, number>> = { inventory: alerts, shopping: toBuy };

  return (
    <div className="shell">
      <header className="topbar">
        <h1>{TABS.find((t) => t.id === tab)?.label}</h1>
        <button type="button" className="link" onClick={() => logout.mutate()}>
          {username} · Sign out
        </button>
      </header>
      <main>
        {tab === 'inventory' && <InventoryPage onScanReceipt={() => go('receipt')} />}
        {tab === 'planner' && <PlannerPage />}
        {tab === 'shopping' && <ShoppingPage />}
        {tab === 'receipt' && <ReceiptPage onDone={() => go('inventory')} />}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab ${tab === t.id ? 'tab-active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
            {!!badges[t.id] && <span className={`tab-badge ${t.id === 'inventory' ? 'tab-badge-alert' : ''}`}>{badges[t.id]}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function tabFromHash(): Tab {
  const hash = location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'inventory';
}
