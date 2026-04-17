import React from "react";
import { NoteProps } from "@dendronhq/common-all";
import { Anchor } from "antd";
import _ from "lodash";
import type { ComponentProps } from "react";

const unslug = (slugs: string) => {
  slugs = slugs.replace(/_/g, "-");
  slugs = slugs.replace(/--/g, "-");
  const list: string[] = [];
  slugs.split("-").forEach((slug) => {
    list.push(slug.substr(0, 1).toUpperCase() + slug.substr(1));
  });
  return list.join(" ");
};

export const DendronTOC = ({
  note,
  ...rest
}: {
  note: NoteProps;
} & ComponentProps<typeof Anchor>) => {
  const items = Object.entries(note?.anchors)
    .filter(([, entry]) => entry?.type === "header")
    .map(([key, entry]) => ({
      key,
      href: `#${key}`,
      title: entry?.text ?? unslug(String(entry?.value ?? "")),
    }));

  return (
    <Anchor style={{ zIndex: 1 }} className="dendron-toc" items={items} {...rest} />
  );
};

export default DendronTOC;
