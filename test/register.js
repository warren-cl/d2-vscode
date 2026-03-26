// Bootstrap: point ts-node at the test tsconfig before registering
process.env.TS_NODE_PROJECT = "test/tsconfig.json";
require("ts-node/register");
