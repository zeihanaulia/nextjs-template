import { DendronPublishingConfig, NoteProps } from "@dendronhq/common-all";
import _ from "lodash";
import { env } from "../env/client";

export function getPathWithPrefix(url: string) {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  const out =
    process.env.NODE_ENV !== "development" && env.NEXT_PUBLIC_ASSET_PREFIX
      ? env.NEXT_PUBLIC_ASSET_PREFIX + normalizedUrl
      : normalizedUrl;
  return out;
}

export function getNotePath(note: NoteProps, noteIndex: NoteProps) {
  return note.id === noteIndex.id
    ? "/"
    : `/${note.fname.split(".").join("/")}`;
}

export function getNoteUrl(opts: { note: NoteProps; noteIndex: NoteProps }) {
  const { note, noteIndex } = opts;
  return getNotePath(note, noteIndex);
}

export function getAssetUrl(url: string) {
  return getPathWithPrefix(url);
}

/**
 * Returns root url of page
 * @param url
 * @returns
 */
export function getRootUrl(siteConfig: DendronPublishingConfig) {
  const url = siteConfig.siteUrl!;
  const out =
    process.env.NODE_ENV !== "development" &&
    process.env.NEXT_PUBLIC_ASSET_PREFIX
      ? url + process.env.NEXT_PUBLIC_ASSET_PREFIX
      : url;
  return out;
}
