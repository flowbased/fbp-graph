export type TransactionEntry = {
  cmd: string,
  args: {
    [key : string]: any,
  },
  rev: number | null,
};
export type JournalMetadata = {
  [key : string]: any,
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
export type GraphJsonNode = {
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
  src?: {
    process: GraphNodeID,
    port: string,
    index?: number,
  }
  data?: any,
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

export type GraphJson = {
  caseSensitive?: boolean,
  properties?: PropertyMap,
  processes?: {
    [key: string]: GraphJsonNode,
  },
  connections?: Array<GraphJsonEdge>,
  inports?: {
    [key: string]: GraphExportedPort,
  },
  outports?: {
    [key: string]: GraphExportedPort,
  },
  groups?: Array<GraphGroup>,
};

