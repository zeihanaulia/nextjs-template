import dynamic from "next/dynamic";
import { GetStaticProps } from "next";
import Head from "next/head";
import { getConfig, getGraphData, GraphData } from "../utils/build";
import { DendronConfig } from "@dendronhq/common-all";

// D3 harus render client-side only — tidak bisa di SSR/SSG DOM
const DendronGraph = dynamic(() => import("../components/DendronGraph"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#6b7280",
        fontSize: 14,
      }}
    >
      Loading graph…
    </div>
  ),
});

interface GraphPageProps {
  graphData: GraphData;
  config: DendronConfig;
}

export default function GraphPage({ graphData }: GraphPageProps) {
  return (
    <>
      <Head>
        <title>Knowledge Graph</title>
        <meta name="description" content="Visualisasi relasi antar catatan dalam vault" />
      </Head>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <DendronGraph data={graphData} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<GraphPageProps> = async () => {
  const [graphData, config] = await Promise.all([
    Promise.resolve(getGraphData()),
    getConfig(),
  ]);
  return {
    props: { graphData, config },
  };
};
