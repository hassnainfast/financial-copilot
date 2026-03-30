import TopNav from '@/components/TopNav';

export default function AppLayout({ children }) {
  return (
    <>
      <TopNav />
      <div className="main-content-area">
        {children}
      </div>
    </>
  );
}
