import { ReactNode } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border py-6 bg-muted/30">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CricketLive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
