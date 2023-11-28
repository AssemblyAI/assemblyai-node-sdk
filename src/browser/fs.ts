function throwError() {
  throw new Error("Function is not supported in this environment.");
}

export const createReadStream = throwError;
export default {
  createReadStream,
};
