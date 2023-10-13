import * as services from "./services";
import { AssemblyAI } from "./services";
export * from "./services";
export type * from "./types";
export default AssemblyAI;
class AssemblyAIExports extends AssemblyAI {}
module.exports = Object.assign(AssemblyAIExports, services);
