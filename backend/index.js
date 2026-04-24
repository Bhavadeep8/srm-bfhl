const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const USER_ID = "bhavadeep_08112005";
const EMAIL_ID = "bo3640@srmist.edu.in";
const COLLEGE_ROLL = "RA2311026010926";

function isValidEntry(entry) {
  const trimmed = entry.trim();
  return /^[A-Z]->[A-Z]$/.test(trimmed);
}

function isSelfLoop(entry) {
  const [parent, child] = entry.trim().split("->");
  return parent === child;
}

function processData(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (let raw of data) {
    const entry = raw.trim();
    if (!isValidEntry(entry) || isSelfLoop(entry)) {
      invalidEntries.push(raw);
      continue;
    }
    if (seenEdges.has(entry)) {
      if (!duplicateEdges.includes(entry)) duplicateEdges.push(entry);
      continue;
    }
    seenEdges.add(entry);
    validEdges.push(entry);
  }

  const childrenMap = {};
  const parentCount = {};
  const allNodes = new Set();

  for (let edge of validEdges) {
    const [parent, child] = edge.split("->");
    allNodes.add(parent);
    allNodes.add(child);
    if (!childrenMap[parent]) childrenMap[parent] = [];
    if (parentCount[child] !== undefined) continue;
    childrenMap[parent].push(child);
    parentCount[child] = parent;
  }

  const childNodes = new Set(Object.keys(parentCount));
  const roots = [...allNodes].filter(n => !childNodes.has(n)).sort();

  const parent = {};
  [...allNodes].forEach(n => (parent[n] = n));

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(a, b) {
    parent[find(a)] = find(b);
  }

  for (let edge of validEdges) {
    const [p, c] = edge.split("->");
    union(p, c);
  }

  const components = {};
  [...allNodes].forEach(n => {
    const root = find(n);
    if (!components[root]) components[root] = [];
    components[root].push(n);
  });

  function hasCycle(startNodes, children) {
    const visited = new Set();
    const stack = new Set();
    function dfs(node) {
      if (stack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      for (let child of (children[node] || [])) {
        if (dfs(child)) return true;
      }
      stack.delete(node);
      return false;
    }
    for (let n of startNodes) {
      if (dfs(n)) return true;
    }
    return false;
  }

  function buildTree(node, children) {
    const result = {};
    for (let child of (children[node] || [])) {
      result[child] = buildTree(child, children);
    }
    return result;
  }

  function calcDepth(node, children) {
    const kids = children[node] || [];
    if (kids.length === 0) return 1;
    return 1 + Math.max(...kids.map(c => calcDepth(c, children)));
  }

  const hierarchies = [];

  for (let compKey of Object.keys(components)) {
    const compNodes = components[compKey];
    const compRoots = compNodes.filter(n => !childNodes.has(n)).sort();
    const cyclic = hasCycle(compNodes, childrenMap);

    if (cyclic) {
      const cycleRoot = [...compNodes].sort()[0];
      hierarchies.push({ root: cycleRoot, tree: {}, has_cycle: true });
    } else {
      for (let r of compRoots) {
        const tree = {};
        tree[r] = buildTree(r, childrenMap);
        const depth = calcDepth(r, childrenMap);
        hierarchies.push({ root: r, tree, depth });
      }
    }
  }

  hierarchies.sort((a, b) => a.root.localeCompare(b.root));

  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largestRoot = "";
  let maxDepth = -1;
  for (let h of nonCyclic) {
    if (h.depth > maxDepth || (h.depth === maxDepth && h.root < largestRoot)) {
      maxDepth = h.depth;
      largestRoot = h.root;
    }
  }

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: nonCyclic.length,
      total_cycles: cyclic.length,
      largest_tree_root: largestRoot
    }
  };
}

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array" });
    }
    const result = processData(data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", (req, res) => res.send("BFHL API is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));