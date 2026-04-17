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
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { DataNode } from "rc-tree/lib/interface";
import { useCombinedSelector } from "../features";
import { DENDRON_STYLE_CONSTANTS } from "../styles/constants";
import { useDendronRouter } from "../utils/hooks";
import { NoteData } from "../utils/types";

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
  onSubMenuSelect,
  onMenuItemClick,
  onExpand,
  collapsed,
  activeNote,
  noteIndex,
}: {
  roots: DataNode[];
  expandKeys: string[];
  onSubMenuSelect: (keys: string) => void;
  onMenuItemClick: (key: string) => void;
  onExpand: (key: string) => void;
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
              pointerEvents: "none",
              margin: 0,
            }}
          />
        </i>
      );
    },
    [collapsed]
  );

  const renderTreeNode = (menu: DataNode, depth = 0) => {
    const hasChildren = Boolean(menu.children && menu.children.length > 0);
    const isOpen = expandKeys.includes(menu.key as string);
    const isSelected = menu.key === activeNote;

    return (
      <li
        key={menu.key}
        className={`dendron-tree-menu-item ${hasChildren ? "has-children" : "leaf"} ${
          isSelected ? "selected" : ""
        }`}
      >
        <div
          className="dendron-tree-menu-row"
          style={{ paddingLeft: 12 + depth * 18 }}
        >
          {hasChildren && (
            <button
              type="button"
              className="dendron-tree-menu-expand-toggle"
              onClick={() => onExpand(menu.key as string)}
              aria-expanded={isOpen}
              aria-label={isOpen ? "Collapse section" : "Expand section"}
            >
              <ExpandIcon isOpen={isOpen} />
            </button>
          )}
          {menu.icon && (() => {
            const iconNode: ReactNode =
              typeof menu.icon === "function"
                ? (menu.icon as (data: DataNode) => ReactNode)(menu)
                : menu.icon;
            return <span className="dendron-tree-menu-icon">{iconNode}</span>;
          })()}
          <MenuItemTitle
            menu={menu}
            noteIndex={noteIndex}
            onSubMenuSelect={onSubMenuSelect}
          />
        </div>
        {hasChildren && isOpen && (
          <ul className="dendron-tree-menu-sublist">
            {menu.children!.map((childMenu: DataNode) => renderTreeNode(childMenu, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className={`dendron-tree-menu${collapsed ? " collapsed" : ""}`} aria-label="Tree menu">
      <ul className="dendron-tree-menu-list">
        {roots.map((menu) => renderTreeNode(menu, 0))}
      </ul>
    </nav>
  );
}

function MenuItemTitle(
  props: Partial<NoteData> & {
    menu: DataNode;
    onSubMenuSelect: (noteId: string) => void;
  }
) {
  const { getNoteUrl } = useDendronRouter();

  const title = typeof props.menu.title === "function" ? props.menu.title(props.menu) : props.menu.title;

  return (
    <Typography.Text className="dendron-tree-menu-title-text" ellipsis={{ tooltip: String(title) }}>
      <Link
        href={getNoteUrl(props.menu.key as string, {
          noteIndex: props.noteIndex!,
        })}
        title={String(title)}
        onClick={() => {
          props.onSubMenuSelect(props.menu.key as string);
        }}
      >
        {title}
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
