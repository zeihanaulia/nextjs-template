import fs from "fs-extra";
import path from "path";
import { ConfigUtils, DendronConfig, NoteProps } from "@dendronhq/common-all";
import _ from "lodash";
import { NoteData } from "./types";
import { GetStaticPathsResult } from "next";
import { ParsedUrlQuery } from "querystring";

export * from "./fetchers";

const NOTE_META_DIR = "meta";
const NOTE_BODY_DIR = "notes";

export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    throw new Error("DATA_DIR not set");
  }
  return dataDir;
}

/**
 *  Returns the HTML representation of a note
 */
export function getNoteBody(id: string): Promise<string> {
  const dataDir = getDataDir();
  const body = fs.readFile(path.join(dataDir, NOTE_BODY_DIR, `${id}.html`), {
    encoding: "utf8",
  });
  return body;
}

let _NOTES_CACHE: NoteData | undefined;

export function getNotes(): NoteData {
  if (_.isUndefined(_NOTES_CACHE)) {
    const dataDir = getDataDir();
    _NOTES_CACHE = fs.readJSONSync(
      path.join(dataDir, "notes.json")
    ) as NoteData;
  }
  return _NOTES_CACHE as NoteData;
}

const NOTE_REF_DIR = "refs";
let _REFS_CACHE: string[] | undefined;
export function getRefBody(id: string) {
  const dataDir = getDataDir();
  const body = fs.readFile(path.join(dataDir, NOTE_REF_DIR, `${id}.html`), {
    encoding: "utf8",
  });
  return body;
}
export function getNoteRefs() {
  if (_.isUndefined(_REFS_CACHE)) {
    const dataDir = getDataDir();
    try {
      _REFS_CACHE = fs.readJSONSync(
        path.join(dataDir, "refs.json")
      ) as string[];
    } catch {
      _REFS_CACHE = [];
    }
  }
  return _REFS_CACHE;
}

export interface DendronNotePageParams extends ParsedUrlQuery {
  slug: string[];
}

function getSlugPath(slug: string | string[]): string {
  return Array.isArray(slug) ? slug.join("/") : slug;
}

function noteSlugPath(fname: string): string {
  const parts = fname.split(".");
  return parts[0] === "notes" && parts.length > 1
    ? parts.slice(1).join("/")
    : parts.join("/");
}

function getNoteBySlug(slug: string | string[]) {
  const slugPath = getSlugPath(slug);
  const { notes } = getNotes();
  return _.find(notes, (note) => noteSlugPath(note.fname) === slugPath);
}

/**
 * Generate URLs for all exported pages
 * For use with getStaticProps
 * https://nextjs.org/docs/basic-features/data-fetching/get-static-props
 * @returns
 */
export function getNotePaths(): GetStaticPathsResult<DendronNotePageParams> {
  const { notes, noteIndex } = getNotes();
  const paths = Object.values(notes)
    .filter((note) => note.id !== noteIndex.id)
    .map((note) => {
      return { params: { slug: noteSlugPath(note.fname).split("/") } };
    });
  return {
    paths,
    fallback: false,
  };
}

/**
 * Reads the JSON contents of data/meta/<note>.json
 */
export function getNoteMeta(id: string): Promise<NoteProps> {
  const dataDir = getDataDir();
  return fs.readJSON(path.join(dataDir, NOTE_META_DIR, `${id}.json`));
}

export function getNoteBySlugPath(slug: string | string[]) {
  return getNoteBySlug(slug);
}

/**
 * Find a note by its fname directly (no dots-to-slashes conversion).
 * Used for /notes/<fname> routes where Dendron HTML links preserve dots.
 */
export function getNoteByFnamePath(slug: string | string[]) {
  const fname = Array.isArray(slug) ? slug.join("/") : slug;
  const { notes } = getNotes();
  return _.find(notes, (note) => note.fname === fname);
}

/**
 * Generate /notes/<fname> paths for all notes.
 * fname is kept as a single path segment with dots preserved,
 * matching the link format that Dendron generates in HTML bodies.
 */
export function getNoteFnamePaths(): GetStaticPathsResult<DendronNotePageParams> {
  const { notes, noteIndex } = getNotes();
  const paths = Object.values(notes)
    .filter((note) => note.id !== noteIndex.id)
    .map((note) => {
      return { params: { slug: [note.fname] } };
    });
  return {
    paths,
    fallback: false,
  };
}

let _CONFIG_CACHE: DendronConfig | undefined;
export function getConfig(): Promise<DendronConfig> {
  if (_.isUndefined(_CONFIG_CACHE)) {
    const dataDir = getDataDir();
    return fs.readJSON(path.join(dataDir, "dendron.json"));
  }
  return new Promise(() => _CONFIG_CACHE);
}

export function getPublicDir(): string {
  const publicDir = process.env.PUBLIC_DIR;
  if (!publicDir) {
    throw new Error("PUBLIC_DIR not set");
  }
  return publicDir;
}

export async function getCustomHead(): Promise<string | null> {
  const config = await getConfig();
  const publishingConfig = ConfigUtils.getPublishing(config);
  const customHeadPathConfig = publishingConfig.customHeaderPath;
  if (_.isUndefined(customHeadPathConfig)) {
    return null;
  }
  const publicDir = getPublicDir();
  const headPath = path.join(publicDir, "header.html");
  return fs.readFileSync(headPath, { encoding: "utf-8" });
}

export type GraphNode = {
  id: string;
  fname: string;
  title: string;
  group: string;
  tags: string[];
};

export type GraphLink = {
  source: string;
  target: string;
  type: "wiki" | "hierarchy";
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export function getGraphData(): GraphData {
  const { notes } = getNotes();
  const noteIds = Object.keys(notes);

  const nodes: GraphNode[] = noteIds.map((id) => {
    const note = notes[id];
    const group = note.fname.split(".")[0];
    const rawTags = note.tags;
    const tags: string[] = Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags as string] : [];
    return { id, fname: note.fname, title: note.title || note.fname, group, tags };
  });

  const links: GraphLink[] = [];
  const noteIdByFname: Record<string, string> = {};
  noteIds.forEach((id) => {
    noteIdByFname[notes[id].fname] = id;
  });

  // Wiki links (explicit [[wikilinks]] in note body)
  noteIds.forEach((id) => {
    const note = notes[id];
    (note.links || [])
      .filter((l: any) => l.type === "wiki")
      .forEach((l: any) => {
        const toFname = l.to && l.to.fname;
        const toId = toFname && noteIdByFname[toFname];
        if (toId && toId !== id) {
          links.push({ source: id, target: toId, type: "wiki" });
        }
      });
  });

  // Hierarchy links (parent → child)
  noteIds.forEach((id) => {
    const note = notes[id];
    (note.children || []).forEach((childId: string) => {
      if (notes[childId]) {
        links.push({ source: id, target: childId, type: "hierarchy" });
      }
    });
  });

  return { nodes, links };
}
