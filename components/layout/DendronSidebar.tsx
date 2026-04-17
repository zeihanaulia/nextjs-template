import React from "react";
import Sider from "antd/lib/layout/Sider";
import { useDendronContext } from "../../context/useDendronContext";
import { DENDRON_STYLE_CONSTANTS } from "../../styles/constants";
import { DendronSearch } from "../DendronSearch";
import DendronTreeMenu from "../DendronTreeMenu";

const { LAYOUT, HEADER, SIDER } = DENDRON_STYLE_CONSTANTS;

export const DendronSideBar: React.FC<any> = (props) => {
  const {
    isResponsive,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setResponsive,
  } = useDendronContext();
  return (
    <div
      className="site-layout-sidebar"
      style={{
        flex: "0 0 auto",
        width: isResponsive
          ? "100%"
          : typeof SIDER.WIDTH === "number"
          ? `${SIDER.WIDTH}px`
          : SIDER.WIDTH,
        minWidth: isResponsive || isSidebarCollapsed ? 0 : SIDER.WIDTH,
      }}
    >
      <Sider
        width={isResponsive ? "100%" : SIDER.WIDTH}
        collapsible
        collapsed={isSidebarCollapsed && isResponsive}
        collapsedWidth={SIDER.COLLAPSED_WIDTH}
        onCollapse={(collapsed) => {
          setIsSidebarCollapsed(collapsed);
        }}
        breakpoint="sm"
        onBreakpoint={(broken) => {
          setResponsive(broken);
        }}
        style={{
          position: "fixed",
          top: HEADER.HEIGHT,
          overflow: "auto",
          height: `calc(100vh - ${HEADER.HEIGHT}px)`,
          backgroundColor: `transparent`,
        }}
        trigger={null}
      >
        {isResponsive && (
          <div style={{ padding: 16 }}>
            <DendronSearch {...props} />
          </div>
        )}
        <DendronTreeMenu
          {...props}
          collapsed={isSidebarCollapsed && isResponsive}
          setCollapsed={setIsSidebarCollapsed}
        />
      </Sider>
    </div>
  );
};

export default DendronSideBar;
