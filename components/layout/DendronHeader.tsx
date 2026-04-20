import { MenuOutlined, ApartmentOutlined } from "@ant-design/icons";
import { Col, Layout, Row, Tooltip } from "antd";
import * as React from "react";
import Link from "next/link";
import { useDendronContext } from "../../context/useDendronContext";
import { DENDRON_STYLE_CONSTANTS } from "../../styles/constants";
import DendronLogoOrTitle from "../DendronLogoOrTitle";
import { DendronSearch } from "../DendronSearch";

const { Header } = Layout;
const { LAYOUT, HEADER } = DENDRON_STYLE_CONSTANTS;

export const DendronHeader: React.FC<any> = (props) => {
  const { isResponsive, isSidebarCollapsed, setIsSidebarCollapsed } =
    useDendronContext();
  return (
    <Header
      style={{
        position: "fixed",
        isolation: "isolate",
        zIndex: 1,
        width: "100%",
        borderBottom: "1px solid #d4dadf",
        height: HEADER.HEIGHT,
        padding: isResponsive ? 0 : `0 ${LAYOUT.PADDING}px 0 2px`,
      }}
    >
      <Row
        justify="center"
        style={{
          maxWidth: "1200px",
          justifyContent: "space-between",
          margin: "0 auto",
        }}
      >
        <Col xs={20} sm={4} style={{ display: "flex" }}>
          <DendronLogoOrTitle />
        </Col>
        <Col xs={0} sm={20} md={20} lg={19} className="gutter-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DendronSearch {...props} />
            <Tooltip title="Knowledge Graph">
              <Link
                href="/graph"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: 6,
                  color: "#4b5563",
                  textDecoration: "none",
                  flexShrink: 0,
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                <ApartmentOutlined />
              </Link>
            </Tooltip>
          </div>
        </Col>
        <Col
          xs={4}
          sm={4}
          md={0}
          lg={0}
          style={{
            display: isResponsive ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MenuOutlined
            style={{ fontSize: 24 }}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </Col>
      </Row>
    </Header>
  );
};
