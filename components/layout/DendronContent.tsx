import React from "react";
import { Divider } from "antd";
import { Content, Footer } from "antd/lib/layout/layout";
import { DendronBreadCrumb } from "../DendronBreadCrumb";
import { FooterText } from "../DendronNoteFooter";
import { DENDRON_STYLE_CONSTANTS } from "../../styles/constants";
import { useDendronContext } from "../../context/useDendronContext";

const { LAYOUT } = DENDRON_STYLE_CONSTANTS;

export const DendronContent: React.FC<any> = (props) => {
  const { isResponsive, isSidebarCollapsed } = useDendronContext();
  return (
    <Content
      className="side-layout-main"
      style={{
        flex: 1,
        minWidth: 0,
        display: !isSidebarCollapsed && isResponsive ? "none" : "block",
      }}
    >
      <div
        style={{
          padding: `${LAYOUT.PADDING + 24}px ${LAYOUT.PADDING}px 0`,
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <DendronBreadCrumb {...props} />
        <div className="main-content" role="main">
          {props.children}
        </div>
      </div>
      <Divider />
      <Footer
        style={{
          padding: `0 ${LAYOUT.PADDING}px ${LAYOUT.PADDING}px`,
        }}
      >
        <FooterText />
      </Footer>
    </Content>
  );
};
