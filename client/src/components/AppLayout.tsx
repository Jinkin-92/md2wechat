import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  {
    to: "/",
    label: "首页"
  },
  {
    to: "/workbench",
    label: "工作台"
  },
  {
    to: "/settings",
    label: "设置"
  }
];

export function AppLayout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-card">
          <span className="badge badge-blue">MdPublisher</span>
          <p className="brand-name">Markdown 转公众号排版</p>
          <p className="brand-desc">告别繁琐排版，专注内容创作。</p>
        </div>

        <nav className="side-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "side-link active" : "side-link")}
            >
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
