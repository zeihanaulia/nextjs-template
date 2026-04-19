import {
  ConfigUtils,
  FuseEngine,
  DendronConfig,
  NoteProps,
  NotePropsByIdDict,
} from "@dendronhq/common-all";
import { verifyEngineSliceState } from "@dendronhq/common-frontend";
import { Grid } from "antd";
import _ from "lodash";
import { NextRouter, useRouter } from "next/router";
import React from "react";
import { useEngineAppSelector } from "../features/engine/hooks";
import { fetchNoteBody } from "./fetchers";
import { getPathWithPrefix } from "./links";

export type NoteRouterQuery = {
  slug?: string | string[];
};

export type DendronRouterProps = ReturnType<typeof useDendronRouter>;

export function getNoteRouterQuery(router: NextRouter) {
  return router.query as Partial<NoteRouterQuery>;
}

function getSlugPath(slug?: string | string[]) {
  if (_.isUndefined(slug)) {
    return undefined;
  }
  return Array.isArray(slug) ? slug.join("/") : slug;
}

function noteSlugPath(fname: string): string {
  const parts = fname.split(".");
  return parts[0] === "notes" && parts.length > 1
    ? parts.slice(1).join("/")
    : parts.join("/");
}

function getNoteIdFromSlug(
  slug: string | string[] | undefined,
  notes?: NotePropsByIdDict
) {
  if (_.isUndefined(slug) || _.isUndefined(notes)) {
    return undefined;
  }
  const slugPath = getSlugPath(slug);
  return _.chain(notes)
    .values()
    .find((note) => noteSlugPath(note.fname) === slugPath)
    .get("id")
    .value() as string | undefined;
}

export function useDendronRouter() {
  const router = useRouter();
  const query = getNoteRouterQuery(router);
  const engine = useEngineAppSelector((state) => state.engine);
  const notes = engine.notes;

  const getNoteUrl = (
    id: string,
    opts: { noteIndex: NoteProps }
  ) => {
    if (id === opts.noteIndex.id) {
      return getPathWithPrefix("/");
    }
    const note = notes?.[id];
    if (note) {
      return getPathWithPrefix(`/${noteSlugPath(note.fname)}`);
    }
    return getPathWithPrefix(`/notes/${id}`);
  };
  const changeActiveNote = (id: string, opts: { noteIndex: NoteProps }) => {
    router.push(getNoteUrl(id, opts));
  };

  const getActiveNote = ({
    notes,
  }: {
    notes: NotePropsByIdDict;
  }): NoteProps | undefined => {
    const maybeSlug = query?.slug;
    const id = getNoteIdFromSlug(maybeSlug, notes);
    return id ? notes[id] : undefined;
  };

  const getActiveNoteId = () => {
    if (_.isUndefined(query.slug)) {
      return "root";
    }
    return getNoteIdFromSlug(query.slug, notes);
  };

  return {
    router,
    query,
    changeActiveNote,
    getNoteUrl,
    getActiveNote,
    getActiveNoteId,
  };
}

/**
 * Get instance of fuse js
 * @param setNoteIndex
 */
export function useDendronLookup(notes?: NotePropsByIdDict) {
  const engine = useEngineAppSelector((state) => state.engine);
  const config = engine.config as DendronConfig | undefined;
  const fuzzThreshold = config
    ? ConfigUtils.getLookup(config).note.fuzzThreshold
    : 0.6;

  const [noteIndex, setNoteIndex] = React.useState<FuseEngine | undefined>(
    undefined
  );
  React.useEffect(() => {
    if (!notes) {
      return;
    }

    const newNoteIndex = new FuseEngine({ mode: "fuzzy", fuzzThreshold });
    newNoteIndex.notesIndex.setCollection(
      _.map(notes, ({ fname, title, id, vault, updated, stub }, _key) => ({
        fname,
        id,
        title,
        vault,
        updated,
        stub,
      }))
    );

    setNoteIndex(newNoteIndex);
  }, [notes, fuzzThreshold]);
  return noteIndex;
}

type DendronNotesHookProps = {
  noteActive: NoteProps | undefined;
};

/**
 * Get the currently active note
 * @param id
 * @returns
 */
export function useNoteActive(id: string | undefined): DendronNotesHookProps {
  const [noteActive, setNoteActive] = React.useState<NoteProps | undefined>();
  const engine = useEngineAppSelector((state) => state.engine);
  React.useEffect(() => {
    if (!verifyEngineSliceState(engine) || !id) {
      return;
    }
    if (id === "root") {
      return setNoteActive(engine.noteIndex);
    }
    // TODO: in the future, we want to fetch this  dynamically
    const note = engine.notes[id];
    setNoteActive(note);
  }, [id, engine.noteIndex, engine]);
  return { noteActive };
}

async function fetchNoteBodyWithId(id: string) {
  return { id, body: await fetchNoteBody(id) };
}

/** Fetch note bodies (markdown), caching them once fetched.
 *
 * @returns A map of note bodies, and a callback to request more notes.
 *
 * Once the requested note bodies are fetched, the hook should cause an automatic
 * re-render.
 */
export function useNoteBodies() {
  // Using this as a set, because React doesn't seem to like actual sets. Tracks all notes requested so far.
  const [requestedIds, setRequestedIds] = React.useState<
    Readonly<{ [noteId: string]: true }>
  >({});
  // All note bodies fetched so far.
  const [noteBodies, setNoteBodies] = React.useState<
    Readonly<{ [noteId: string]: string }>
  >({});

  React.useEffect(() => {
    // Fetch all requested notes we don't already have
    const fetches: Promise<{ id: string; body: string }>[] = [];
    Object.keys(requestedIds).forEach((id) => {
      if (noteBodies[id] !== undefined) return;
      fetches.push(fetchNoteBodyWithId(id));
    });
    // Avoid resetting noteBodies if we are not fetching anything
    if (fetches.length === 0) return;

    // Once all fetches are done, update the note bodies
    Promise.all(fetches).then((notes) => {
      const newNoteBodies = { ...noteBodies };
      notes.forEach(({ id, body }) => {
        newNoteBodies[id] = body;
      });
      // force a re-render
      setNoteBodies(newNoteBodies);
    });
  }, [noteBodies, requestedIds]);

  // The callback to request more notes to be feched.
  function requestNotes(ids: string[]) {
    const newRequestedIds = { ...requestedIds };
    let changed = false;
    for (const id of ids) {
      if (requestedIds[id] === true) continue;
      newRequestedIds[id] = true;
      changed = true;
    }
    // re-run the effect to fetch these notes, if any new notes have been requested
    if (changed) setRequestedIds(newRequestedIds);
  }

  return { noteBodies, requestNotes };
}

export function useIsMobile() {
  const screens = Grid.useBreakpoint();
  const isMobile = !_.some([screens.md, screens.lg, screens.xl, screens.xxl]);
  return { isMobile, screens };
}
