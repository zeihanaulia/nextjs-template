import { DendronError, error2PlainObject } from "@dendronhq/common-all";
import _ from "lodash";
import { GetStaticPaths, GetStaticProps } from "next";
import { prepChildrenForCollection } from "../components/DendronCollection";
import DendronNotePage, {
  DendronNotePageProps,
} from "../components/DendronNotePage";
import {
  DendronNotePageParams,
  getConfig,
  getCustomHead,
  getNoteBody,
  getNoteMeta,
  getNotePaths,
  getNoteBySlugPath,
  getNotes,
} from "../utils/build";

export default DendronNotePage;

export const getStaticPaths: GetStaticPaths<DendronNotePageParams> =
  getNotePaths;

export const getStaticProps: GetStaticProps<
  DendronNotePageProps,
  DendronNotePageParams
> = async ({ params }) => {
  if (!params) {
    throw Error("params required");
  }

  const { slug } = params;

  if (!slug) {
    throw Error("slug required");
  }

  const note = getNoteBySlugPath(slug);
  if (_.isUndefined(note)) {
    return {
      notFound: true,
    };
  }

  try {
    const [body, noteMeta] = await Promise.all([
      getNoteBody(note.id),
      getNoteMeta(note.id),
    ]);
    const noteData = getNotes();
    const customHeadContent: string | null = await getCustomHead();
    const { notes, noteIndex } = noteData;
    const collectionChildren = noteMeta.custom?.has_collection
      ? prepChildrenForCollection(noteMeta, notes)
      : null;
    const props: DendronNotePageProps = {
      note: noteMeta,
      body,
      noteIndex,
      collectionChildren,
      customHeadContent,
      config: await getConfig(),
    };

    return {
      props,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(error2PlainObject(err as DendronError));
    throw err;
  }
};
