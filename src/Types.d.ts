export type TransactionEntry = {
  cmd: string,
  args: {
    [key : string]: any,
  },
  rev: number,
};

export type GraphOptions = {
  caseSensitive?: boolean,
};

export type PropertyMap = {
  [key : string]: any,
};

export type GraphNodeID = string;
export type GraphNodeMetadata = PropertyMap;
export type GraphNode = {
  id: GraphNodeID,
  component: string,
  metadata?: GraphNodeMetadata,
}

export type GraphEdgeMetadata = PropertyMap;
export type GraphEdge = {
  from: {
    node: GraphNodeID,
    port: string,
    index?: number,
  },
  to: {
    node: GraphNodeID,
    port: string,
    index?: number,
  },
  metadata?: GraphEdgeMetadata,
}
export type GraphJsonEdge = {
  src: {
    process: GraphNodeID,
    port: string,
    index?: number,
  },
  tgt: {
    process: GraphNodeID,
    port: string,
    index?: number,
  },
  metadata?: GraphEdgeMetadata,
}

export type GraphIIPMetadata = PropertyMap;
export type GraphIIP = {
  from: {
    data: any,
  },
  to: {
    node: GraphNodeID,
    port: string,
    index?: number,
  },
  metadata?: GraphIIPMetadata,
}

export type GraphJsonIIP = {
  data: any,
  tgt: {
    process: GraphNodeID,
    port: string,
    index?: number,
  },
  metadata?: GraphIIPMetadata,
};

export type GraphExportedPort = {
  process: GraphNodeID,
  port: string,
  metadata?: GraphNodeMetadata,
};

export type GraphGroupMetadata = PropertyMap;
export type GraphGroup = {
  name: string,
  nodes: Array<GraphNodeID>,
  metadata?: GraphGroupMetadata,
};
