import Graph from "graphology";
import Sigma from "sigma";
import circularLayout from "graphology-layout/circular.js";
import randomLayout from "graphology-layout/random.js";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import pagerank from "graphology-metrics/centrality/pagerank.js";
import degreeCentrality from "graphology-metrics/centrality/degree.js";
import louvain from "graphology-communities-louvain";
import gexf from "graphology-gexf/browser";

window.EditorWorkbenchSigmaGraphology = {
  Graph,
  Sigma,
  layouts: {
    circular: circularLayout,
    random: randomLayout,
    forceAtlas2,
    noverlap
  },
  metrics: {
    degreeCentrality,
    pagerank
  },
  communities: {
    louvain
  },
  gexf
};
