import type { ReactNode } from 'react';
import { DashboardPasswordGate } from './DashboardPasswordGate';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardPasswordGate>{children}</DashboardPasswordGate>;
}
