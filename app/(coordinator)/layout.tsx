export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-1 flex-col bg-page">{children}</div>;
}
