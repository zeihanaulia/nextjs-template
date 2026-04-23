import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { useRouter } from "next/router";
import { GraphData, GraphNode } from "../utils/build";

// ── Colors ────────────────────────────────────────────────────────────────────
// Node group color definitions used by the graph and legend.
const GROUP_COLORS: Record<string, string> = {
  zettel: "#7c3aed",
  "book-summaries": "#0891b2",
  handbook: "#059669",
  notes: "#d97706",
  "today-i-learned": "#dc2626",
  daily: "#be185d",
  tags: "#64748b",
  root: "#94a3b8",
};

// Resolve a group name to its display color.
function groupColor(g: string): string {
  return GROUP_COLORS[g] ?? "#6366f1";
}

// ── Tree data type ───────────────────────────────────────────────────────────
// Graph node typed for the hierarchical tree layout.
type TreeNodeData = GraphNode & { children?: TreeNodeData[] };

// Build a root-based hierarchical tree from graph hierarchy links.
// The result drives the D3 radial layout, with parent/child relationships.
function buildHierarchy(data: GraphData): TreeNodeData {
  const childrenById: Record<string, string[]> = {};
  const hasParent = new Set<string>();

  data.links
    .filter((l) => l.type === "hierarchy")
    .forEach((l) => {
      const src = l.source as string;
      const tgt = l.target as string;
      if (!childrenById[src]) childrenById[src] = [];
      childrenById[src].push(tgt);
      hasParent.add(tgt);
    });

  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const topLevel = data.nodes.filter((n) => !hasParent.has(n.id));

  function build(id: string, visited = new Set<string>()): TreeNodeData | null {
    // Recursively convert each note into a tree node, guarding against cycles.
    if (visited.has(id)) return null;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return null;
    const kids = (childrenById[id] ?? [])
      .map((cid) => build(cid, new Set(visited)))
      .filter((x): x is TreeNodeData => x !== null);
    return { ...node, children: kids.length > 0 ? kids : undefined };
  }

  const children = topLevel
    .map((n) => build(n.id))
    .filter((x): x is TreeNodeData => x !== null);

  return {
    id: "__root__",
    fname: "",
    title: "Knowledge Base",
    group: "root",
    tags: [],
    children,
  };
}

interface PosEntry { x: number; y: number; angle: number; dragged?: boolean; }
interface Selection { id: string; title: string; }
interface DendronGraphProps { data: GraphData; }

export default function DendronGraph({ data }: DendronGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  // Selection state for node interactions.
  const [selection, setSelection] = useState<Selection | null>(null);
  // Hover text shown in the UI when the pointer is over a node.
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);
  // Filter state for the controls bar.
  const [zettelOnly, setZettelOnly] = useState(false);
  const [selectedMoc, setSelectedMoc] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsCollapsed, setTagsCollapsed] = useState(true);
  const TAGS_PREVIEW = 15; // Number of tags shown before collapsing.

  // D3 rendering state held outside of React state for performance.
  const posMapRef = useRef<Map<string, PosEntry>>(new Map());
  const wikiLayerRef = useRef<d3.Selection<any, any, any, any> | null>(null);
  const treeLinkLayerRef = useRef<d3.Selection<any, any, any, any> | null>(null);
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, d3.HierarchyNode<TreeNodeData>, SVGGElement, unknown> | null>(null);
  // Ref to avoid stale closure in D3 click handler.
  const selectionRef = useRef<Selection | null>(null);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  // ── Filtered data ─────────────────────────────────────────────────────────
  // Apply UI filters to the graph data, returning only nodes and links that match.
  const filteredData = useMemo(() => {
    if (!zettelOnly && selectedTags.length === 0 && !selectedMoc) return data;
    let candidates = data.nodes;
    if (zettelOnly) candidates = candidates.filter((n) => n.group === "zettel");
    if (selectedMoc) {
      const wikiAdj = new Map<string, Set<string>>();
      data.links.filter((l) => l.type === "wiki").forEach((l) => {
        const src = l.source as string;
        const tgt = l.target as string;
        if (!wikiAdj.has(src)) wikiAdj.set(src, new Set());
        if (!wikiAdj.has(tgt)) wikiAdj.set(tgt, new Set());
        wikiAdj.get(src)!.add(tgt);
        wikiAdj.get(tgt)!.add(src);
      });
      const neighborhood = new Set([
        selectedMoc,
        ...Array.from(wikiAdj.get(selectedMoc) ?? []),
      ]);
      candidates = candidates.filter((n) => neighborhood.has(n.id));
    }
    if (selectedTags.length > 0) {
      candidates = candidates.filter((n) => selectedTags.some((t) => n.tags.includes(t)));
    }
    const nodeIdSet = new Set(candidates.map((n) => n.id));
    const filteredLinks = data.links.filter(
      (l) => nodeIdSet.has(l.source as string) && nodeIdSet.has(l.target as string)
    );
    return { nodes: candidates, links: filteredLinks };
  }, [data, zettelOnly, selectedMoc, selectedTags]);

  // Cached list of all MOC notes so the UI can render MOC filter chips.
  const mocNotes = useMemo(
    () => data.nodes.filter((n) => n.tags.some((t) => t === "moc")),
    [data.nodes]
  );

  // Cached set of all tags exposed by the graph data.
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    data.nodes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [data.nodes]);

  // Wiki links index (bidirectional)
  // Used to highlight connected nodes when a selection is active.
  const wikiByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    filteredData.links
      .filter((l) => l.type === "wiki")
      .forEach((l) => {
        const src = l.source as string;
        const tgt = l.target as string;
        if (!map.has(src)) map.set(src, []);
        if (!map.has(tgt)) map.set(tgt, []);
        map.get(src)!.push(tgt);
        map.get(tgt)!.push(src);
      });
    return map;
  }, [filteredData]);

  // Degree map: total connections per node (wiki + hierarchy)
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.nodes.forEach((n) => map.set(n.id, 0));
    filteredData.links.forEach((l) => {
      const src = l.source as string;
      const tgt = l.target as string;
      map.set(src, (map.get(src) ?? 0) + 1);
      map.set(tgt, (map.get(tgt) ?? 0) + 1);
    });
    return map;
  }, [filteredData]);

  // Top 5 most connected nodes
  const topHubs = useMemo(() => {
    return [...filteredData.nodes]
      .sort((a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0))
      .slice(0, 6)
      .map((n) => ({ ...n, degree: degreeMap.get(n.id) ?? 0 }))
      .filter((n) => n.degree > 0);
  }, [filteredData.nodes, degreeMap]);

  // ── Build radial tree ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    setSelection(null);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    posMapRef.current.clear();

    const W = svgRef.current.clientWidth || window.innerWidth;
    const H = svgRef.current.clientHeight || window.innerHeight - 60;

    const hierarchyData = buildHierarchy(filteredData);
    const root = d3.hierarchy(hierarchyData);
    const nodeCount = root.descendants().length;
    const radius = Math.max(200, Math.min(520, nodeCount * 4.5));

    // Radial tree layout
    d3.tree<TreeNodeData>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(root);

    // Store cartesian positions + original angle
    root.descendants().forEach((d) => {
      const angle = (d as any).x as number;
      const r = (d as any).y as number;
      posMapRef.current.set(d.data.id, {
        x: r * Math.sin(angle),
        y: -r * Math.cos(angle),
        angle,
      });
    });

    // Zoom — filter: hanya aktif kalau bukan drag on node
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 12])
      .filter((event) => {
        // allow wheel always; allow pointer only if not on a node circle/text
        if (event.type === "wheel") return true;
        return (event.target as Element).tagName !== "circle" &&
               (event.target as Element).tagName !== "text";
      })
      .on("zoom", (e) => g.attr("transform", e.transform.toString()));

    svg.attr("width", "100%").attr("height", "100%").call(zoom);

    const g = svg.append("g");

    // Transparent background rect — click to deselect
    g.append("rect")
      .attr("x", -radius * 3).attr("y", -radius * 3)
      .attr("width", radius * 6).attr("height", radius * 6)
      .attr("fill", "transparent")
      .on("click", () => setSelection(null));

    // Initial zoom — fit the tree in viewport
    const initialScale = Math.min(0.88, (Math.min(W, H) * 0.85) / (radius * 2.5));
    svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(initialScale));

    // ── Hierarchy tree links ───────────────────────────────────────────────
    const treeLinkLayer = g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#dde3ea")
      .attr("stroke-width", 1);

    // Use straight lines so we can cheaply update on node drag
    treeLinkLayer
      .selectAll<SVGLineElement, d3.HierarchyLink<TreeNodeData>>("line.draggable-link")
      .data(root.links())
      .join("line")
      .classed("draggable-link", true)
      .attr("x1", (d) => posMapRef.current.get(d.source.data.id)?.x ?? 0)
      .attr("y1", (d) => posMapRef.current.get(d.source.data.id)?.y ?? 0)
      .attr("x2", (d) => posMapRef.current.get(d.target.data.id)?.x ?? 0)
      .attr("y2", (d) => posMapRef.current.get(d.target.data.id)?.y ?? 0);

    treeLinkLayerRef.current = treeLinkLayer;

    // Wiki link overlay layer (populated separately via selectedId effect)
    wikiLayerRef.current = g.append("g");

    // ── Nodes ─────────────────────────────────────────────────────────────
    const visibleNodes = root.descendants().filter((d) => d.data.id !== "__root__");

    const maxDeg = Math.max(1, ...Array.from(degreeMap.values()));
    const rScale = d3.scaleSqrt<number>().domain([0, maxDeg]).range([3.5, 30]);
    const nodeR = (d: d3.HierarchyNode<TreeNodeData>): number =>
      rScale(degreeMap.get(d.data.id) ?? 0);

    const nodeGroup = g
      .append("g")
      .selectAll<SVGGElement, d3.HierarchyNode<TreeNodeData>>("g")
      .data(visibleNodes)
      .join("g")
      .attr("transform", (d) => {
        const p = posMapRef.current.get(d.data.id);
        return p ? `translate(${p.x},${p.y})` : "translate(0,0)";
      })
      .style("cursor", "grab")
      .call(
        d3.drag<SVGGElement, d3.HierarchyNode<TreeNodeData>>()
          .on("start", function(event) {
            event.sourceEvent.stopPropagation();
            d3.select(this).style("cursor", "grabbing");
          })
          .on("drag", function(event, d) {
            const p = posMapRef.current.get(d.data.id)!;
            p.x += event.dx;
            p.y += event.dy;
            p.dragged = true;
            d3.select(this).attr("transform", `translate(${p.x},${p.y})`);
            // Redraw all tree links that touch this node
            treeLinkLayerRef.current?.selectAll<SVGLineElement, d3.HierarchyLink<TreeNodeData>>("line.draggable-link")
              .attr("x1", (ld) => posMapRef.current.get(ld.source.data.id)?.x ?? 0)
              .attr("y1", (ld) => posMapRef.current.get(ld.source.data.id)?.y ?? 0)
              .attr("x2", (ld) => posMapRef.current.get(ld.target.data.id)?.x ?? 0)
              .attr("y2", (ld) => posMapRef.current.get(ld.target.data.id)?.y ?? 0);
            // Update wiki overlay if this node is selected
            if (selectionRef.current?.id === d.data.id) {
              setSelection(sel => sel ? { ...sel } : null);
            }
          })
          .on("end", function() {
            d3.select(this).style("cursor", "grab");
          })
      )
      .on("mouseenter", (_, d) => {
        const deg = degreeMap.get(d.data.id) ?? 0;
        setHoveredTitle(deg > 0 ? `${d.data.title}  ·  ${deg} koneksi` : d.data.title);
      })
      .on("mouseleave", () => setHoveredTitle(null))
      .on("click", (event, d) => {
        event.stopPropagation();
        const cur = selectionRef.current;
        const next = cur?.id === d.data.id
          ? null
          : { id: d.data.id, title: d.data.title };
        selectionRef.current = next;
        setSelection(next);
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        router.push("/" + d.data.fname.split(".").join("/"));
      });

    nodeGroupRef.current = nodeGroup;

    nodeGroup
      .append("circle")
      .attr("r", nodeR)
      .attr("fill", (d) => groupColor(d.data.group))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.2)
      .attr("fill-opacity", 0.9);

    // Labels — text-anchor and x determined by which half of the circle
    nodeGroup
      .append("text")
      .attr("dy", "0.32em")
      .attr("text-anchor", (d) => {
        const p = posMapRef.current.get(d.data.id);
        return p && p.angle < Math.PI ? "start" : "end";
      })
      .attr("x", (d) => {
        const p = posMapRef.current.get(d.data.id);
        const r = nodeR(d);
        return p && p.angle < Math.PI ? r + 4 : -(r + 4);
      })
      .attr("font-size", (d) => {
        const deg = degreeMap.get(d.data.id) ?? 0;
        return deg >= 12 ? "12px" : deg >= 5 ? "10px" : "9px";
      })
      .attr("font-weight", (d) => {
        const deg = degreeMap.get(d.data.id) ?? 0;
        return deg >= 10 ? "700" : deg >= 4 ? "600" : "normal";
      })
      .attr("fill", (d) => {
        const deg = degreeMap.get(d.data.id) ?? 0;
        return deg >= 10 ? "#1f2937" : "#4b5563";
      })
      .attr("pointer-events", "none")
      .text((d) => {
        const t = d.data.title;
        const deg = degreeMap.get(d.data.id) ?? 0;
        const max = deg >= 12 ? 30 : deg >= 5 ? 24 : 18;
        return t.length > max ? t.slice(0, max - 2) + "…" : t;
      });

  }, [filteredData, router, degreeMap]);

  // ── Wiki link overlay — updated on selection change only ──────────────────
  useEffect(() => {
    const layer = wikiLayerRef.current;
    if (!layer) return;
    layer.selectAll("*").remove();
    if (!selection) return;

    const srcPos = posMapRef.current.get(selection.id);
    if (!srcPos) return;

    const neighbors = wikiByNode.get(selection.id) ?? [];

    // Arc for each wiki neighbor
    neighbors.forEach((nid) => {
      const tgtPos = posMapRef.current.get(nid);
      if (!tgtPos) return;

      // Bezier control point pulled toward center (0,0)
      const cpx = (srcPos.x + tgtPos.x) * 0.25;
      const cpy = (srcPos.y + tgtPos.y) * 0.25;

      layer
        .append("path")
        .attr("d", `M${srcPos.x},${srcPos.y} Q${cpx},${cpy} ${tgtPos.x},${tgtPos.y}`)
        .attr("fill", "none")
        .attr("stroke", "#7c3aed")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.7)
        .attr("stroke-dasharray", "5,3");

      // Ring on target
      layer
        .append("circle")
        .attr("cx", tgtPos.x).attr("cy", tgtPos.y)
        .attr("r", 7)
        .attr("fill", "none")
        .attr("stroke", "#7c3aed")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.75);
    });

    // Ring on selected source
    layer
      .append("circle")
      .attr("cx", srcPos.x).attr("cy", srcPos.y)
      .attr("r", 11)
      .attr("fill", "none")
      .attr("stroke", "#7c3aed")
      .attr("stroke-width", 2.5);

  }, [selection, wikiByNode]);

  const groups = Array.from(new Set(filteredData.nodes.map((n) => n.group))).sort();
  const wikiLinkCount = filteredData.links.filter((l) => l.type === "wiki").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc", position: "relative" }}>

      {/* Controls bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap", flexShrink: 0, zIndex: 2 }}>
        <span style={{ fontWeight: 600, color: "#374151", fontSize: 14 }}>Knowledge Graph</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>
          {filteredData.nodes.length === data.nodes.length
            ? `${data.nodes.length} notes · ${wikiLinkCount} wiki links`
            : `${filteredData.nodes.length}/${data.nodes.length} notes · ${wikiLinkCount} wiki links`}
        </span>
        <button
          onClick={() => { setZettelOnly((v) => !v); setSelectedMoc(""); setSelectedTags([]); }}
          style={{
            padding: "2px 10px", borderRadius: 12, border: "1px solid",
            borderColor: zettelOnly ? "#7c3aed" : "#d1d5db",
            background: zettelOnly ? "#f5f3ff" : "transparent",
            color: zettelOnly ? "#7c3aed" : "#9ca3af",
            cursor: "pointer", fontSize: 11, fontWeight: zettelOnly ? 600 : 400,
          }}
        >
          zettel
        </button>
        <span style={{ color: "#6b7280", fontSize: 11, borderLeft: "1px solid #e5e7eb", paddingLeft: 12 }}>🔥 top hub:</span>
        {topHubs.slice(0, 5).map((n) => (
          <span key={n.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: groupColor(n.group), display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "#374151" }}>{n.title.length > 18 ? n.title.slice(0, 16) + "…" : n.title}</span>
            <span style={{ color: "#9ca3af" }}>({n.degree})</span>
          </span>
        ))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
          {groups.map((grp) => (
            <span key={grp} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#374151" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: groupColor(grp), display: "inline-block", flexShrink: 0 }} />
              {grp}
            </span>
          ))}
        </div>
      </div>

      {/* Filter chips — always visible */}
      {(mocNotes.length > 0 || availableTags.length > 0) && (
        <div style={{ background: "#faf5ff", borderBottom: "1px solid #ede9fe", flexShrink: 0, zIndex: 2 }}>
          {/* MOC row */}
          {mocNotes.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 16px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, flexShrink: 0, minWidth: 36 }}>MOC:</span>
              {mocNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedMoc((v) => v === n.id ? "" : n.id)}
                  style={{
                    padding: "1px 9px", borderRadius: 10, border: "1px solid",
                    borderColor: selectedMoc === n.id ? "#7c3aed" : "#c4b5fd",
                    background: selectedMoc === n.id ? "#7c3aed" : "#fff",
                    color: selectedMoc === n.id ? "#fff" : "#7c3aed",
                    cursor: "pointer", fontSize: 11, flexShrink: 0,
                  }}
                >
                  {n.title}
                </button>
              ))}
            </div>
          )}
          {/* Tags row — collapsible */}
          {availableTags.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 16px 6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, flexShrink: 0, minWidth: 36, paddingTop: 2 }}>tags:</span>
              {(tagsCollapsed ? availableTags.slice(0, TAGS_PREVIEW) : availableTags).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTags((v) => v.includes(t) ? v.filter((x) => x !== t) : [...v, t])}
                  style={{
                    padding: "1px 9px", borderRadius: 10, border: "1px solid",
                    borderColor: selectedTags.includes(t) ? "#6366f1" : "#d1d5db",
                    background: selectedTags.includes(t) ? "#6366f1" : "#fff",
                    color: selectedTags.includes(t) ? "#fff" : "#6b7280",
                    cursor: "pointer", fontSize: 11, flexShrink: 0,
                  }}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setTagsCollapsed((v) => !v)}
                style={{
                  padding: "1px 9px", borderRadius: 10, border: "1px dashed #d1d5db",
                  background: "transparent", color: "#9ca3af",
                  cursor: "pointer", fontSize: 11, flexShrink: 0,
                }}
              >
                {tagsCollapsed ? `+${availableTags.length - TAGS_PREVIEW} more` : "show less"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected node banner */}
      <div style={{ position: "absolute", top: 54, left: "50%", transform: "translateX(-50%)", zIndex: 3, pointerEvents: "none", transition: "opacity 0.2s", opacity: selection ? 1 : 0 }}>
        <div style={{ background: "rgba(30,20,60,0.82)", color: "#e9d5ff", padding: "5px 18px", borderRadius: 20, fontSize: 13, backdropFilter: "blur(6px)", whiteSpace: "nowrap" }}>
          <strong>{selection?.title}</strong>
          <span style={{ color: "#a78bfa", marginLeft: 10, fontWeight: 400 }}>
            — wiki links shown · double-click to open · click bg to reset
          </span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredTitle && !selection && (
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(30,30,40,0.8)", color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 13, pointerEvents: "none", zIndex: 10, backdropFilter: "blur(4px)", whiteSpace: "nowrap" }}>
          {hoveredTitle}
        </div>
      )}

      {/* Instruction hint */}
      {!selection && (
        <div style={{ position: "absolute", bottom: 18, right: 20, color: "#9ca3af", fontSize: 11, pointerEvents: "none", zIndex: 3, lineHeight: 1.7, textAlign: "right" }}>
          scroll to zoom · drag canvas to pan · <strong>drag node</strong> to reposition
          <br />
          <strong>click node</strong> → show wiki links · <strong>double-click</strong> → open note
        </div>
      )}

      <svg ref={svgRef} style={{ flex: 1, width: "100%", height: "100%" }} />
    </div>
  );
}
