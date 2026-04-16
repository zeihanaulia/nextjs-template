import {
  DownOutlined,
  NumberOutlined,
  PlusOutlined,
  RightOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { isNotUndefined, TreeMenuNode, TreeUtils } from "@dendronhq/common-all";
import { createLogger } from "@dendronhq/common-frontend";
import { Typography } from "antd";
import _ from "lodash";
import dynamic from "next/dynamic";
import Link from "next/link";
import { DataNode } from "rc-tree/lib/interface";
import { useCallback, useEffect, useState } from "react";
import { useCombinedSelector } from "../features";
import { DENDRON_STYLE_CONSTANTS } from "../styles/constants";
import { useDendronRouter } from "../utils/hooks";
import { NoteData } from "../utils/types";

const Menu = dynamic(() => import("./AntdMenuWrapper"), {
  ssr: false,
});

const SubMenu = dynamic(() => import("./AntdSubMenuWrapper"), {
  ssr: false,
});

const MenuItem = dynamic(() => import("./AntdMenuItemWrapper"), {
  ssr: false,
});

export default function DendronTreeMenu(
  props: Partial<NoteData> & {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
  }
) {
  const ide = useCombinedSelector((state) => state.ide);
  const tree = ide.tree;
  const logger = createLogger("DendronTreeMenu");
  const dendronRouter = useDendronRouter();
  const [activeNoteIds, setActiveNoteIds] = useState<string[]>([]);
  const noteActiveId = _.isUndefined(dendronRouter.query.slug)
    ? props.noteIndex?.id
    : dendronRouter.getActiveNoteId();

  // set `activeNoteIds`
  useEffect(() => {
    if (!noteActiveId || !tree) {
      return undefined;
    }
    logger.info({
      state: "useEffect:preCalculateTree",
    });

    // all parents should be in expanded position
    const newActiveNoteIds = TreeUtils.getAllParents({
      child2parent: tree.child2parent ?? {},
      noteId: noteActiveId,
    });

    const activeNote = findTreeNode(tree.roots, noteActiveId);

    if (activeNote && activeNote.children?.length) {
      newActiveNoteIds.push(noteActiveId);
    }

    setActiveNoteIds(newActiveNoteIds);
    return undefined;
  }, [props.noteIndex, dendronRouter.query.slug, noteActiveId, tree]);

  const { notes, collapsed, setCollapsed } = props;

  const expandKeys = _.isEmpty(activeNoteIds) ? [] : activeNoteIds;
  if (!tree) {
    return null;
  }

  const roots = treeMenuNode2DataNode({
    roots: tree.roots,
    showVaultName: false,
  });

  // --- Methods
  const onSubMenuSelect = (noteId: string) => {
    logger.info({ ctx: "onSubMenuSelect", id: noteId });
    setCollapsed(true);
  };

  const onMenuItemClick = (noteId: string) => {
    logger.info({ ctx: "onMenuItemClick", id: noteId });
    setCollapsed(true);
  };

  const onExpand = (noteId: string) => {
    logger.info({ ctx: "onExpand", id: noteId });
    const expanded = expandKeys.includes(noteId);
    // open up
    if (expanded) {
      setActiveNoteIds(
        TreeUtils.getAllParents({ child2parent: tree.child2parent ?? {}, noteId })
      );
    } else {
      setActiveNoteIds(
        TreeUtils.getAllParents({
          child2parent: tree.child2parent ?? {},
          noteId,
        }).concat([noteId])
      );
    }
  };

  return noteActiveId ? (
    <MenuView
      {...props}
      roots={roots}
      expandKeys={expandKeys}
      onOpenChange={(keys) => {
        setActiveNoteIds(keys);
      }}
      onSubMenuSelect={onSubMenuSelect}
      onMenuItemClick={onMenuItemClick}
      onExpand={onExpand}
      collapsed={collapsed}
      activeNote={noteActiveId}
    />
  ) : (
    <></>
  );
}

function MenuView({
  roots,
  expandKeys,
  onOpenChange,
  onSubMenuSelect,
  onMenuItemClick,
  onExpand,
  collapsed,
  activeNote,
  noteIndex,
}: {
  roots: DataNode[];
  expandKeys: string[];
  onOpenChange: (keys: string[]) => void;
  onSubMenuSelect: (noteId: string) => void;
  onMenuItemClick: (noteId: string) => void;
  onExpand: (noteId: string) => void;
  collapsed: boolean;
  activeNote: string;
} & Partial<NoteData>) {
  const ExpandIcon = useCallback(
    ({ isOpen }: { isOpen: boolean }) => {
      const UncollapsedIcon = isOpen ? UpOutlined : DownOutlined;
      const Icon = collapsed ? RightOutlined : UncollapsedIcon;
      return (
        <i data-expandedicon="true">
          <Icon
            style={{
              pointerEvents: "none", // only allow custom element to be gesture target
              margin: 0,
            }}
          />
        </i>
      );
    },
    [collapsed]
  );

  const createMenu = (menu: DataNode) => {
    if (menu.children && menu.children.length > 0) {
      return (
        // @ts-ignore
        <SubMenu
          // @ts-ignore
          icon={menu.icon}
          className={
            menu.key === activeNote ? "dendron-ant-menu-submenu-selected" : ""
          }
          key={menu.key}
          title={
            <MenuItemTitle
              menu={menu}
              noteIndex={noteIndex}
              onSubMenuSelect={onSubMenuSelect}
            />
          }
        >
          {menu.children.map((childMenu: DataNode) => {
            return createMenu(childMenu);
          })}
        </SubMenu>
      );
    }
    return (
      // @ts-ignore
      <MenuItem key={menu.key} icon={menu.icon}>
        <MenuItemTitle
          menu={menu}
          noteIndex={noteIndex}
          onSubMenuSelect={onSubMenuSelect}
        />
      </MenuItem>
    );
  };

  return (
    // @ts-ignore
    <Menu
      key={String(collapsed)}
      className="dendron-tree-menu"
      mode="inline"
      {...(!collapsed && {
        openKeys: expandKeys,
        selectedKeys: [...expandKeys, activeNote],
      })}
      onOpenChange={onOpenChange}
      inlineIndent={DENDRON_STYLE_CONSTANTS.SIDER.INDENT}
      // @ts-ignore
      expandIcon={ExpandIcon}
      inlineCollapsed={collapsed}
      // results in gray box otherwise when nav bar is too short for display
      style={{ height: "100%" }}
      onClick={({ key }) => {
        onMenuItemClick(key);
      }}
    >
      {roots.map((menu) => {
        return createMenu(menu);
      })}
    </Menu>
  );
}

function MenuItemTitle(
  props: Partial<NoteData> & {
    menu: DataNode;
    onSubMenuSelect: (noteId: string) => void;
  }
) {
  const { getNoteUrl } = useDendronRouter();

  return (
    // @ts-ignore
    <Typography.Text ellipsis={{ tooltip: props.menu.title }}>
      <Link
        href={getNoteUrl(props.menu.key as string, {
          noteIndex: props.noteIndex!,
        })}
        onClick={() => {
          props.onSubMenuSelect(props.menu.key as string);
        }}
      >
        {/* @ts-ignore */}
        {props.menu.title}
      </Link>
    </Typography.Text>
  );
}

function treeMenuNode2DataNode({
  roots,
  showVaultName,
}: {
  roots: TreeMenuNode[];
  showVaultName?: boolean;
}): DataNode[] {
  return roots
    .map((node: TreeMenuNode) => {
      let icon;
      if (node.icon === "numberOutlined") {
        icon = <NumberOutlined />;
      } else if (node.icon === "plusOutlined") {
        icon = <PlusOutlined />;
      }

      let title: any = node.title;
      if (showVaultName) title = `${title} (${node.vaultName})`;

      if (node.hasTitleNumberOutlined) {
        title = (
          <span>
            <NumberOutlined />
            {title}
          </span>
        );
      }

      return {
        key: node.key,
        title,
        icon,
        children: node.children
          ? treeMenuNode2DataNode({
              roots: node.children,
              showVaultName,
            })
          : [],
      };
    })
    .filter(isNotUndefined);
}

function findTreeNode(
  nodes: TreeMenuNode[],
  key: string
): TreeMenuNode | undefined {
  for (const node of nodes) {
    if (node.key === key) {
      return node;
    }
    const childMatch = node.children?.length
      ? findTreeNode(node.children, key)
      : undefined;
    if (childMatch) {
      return childMatch;
    }
  }
  return undefined;
}
