# Contribute

We welcome contributions from the community.

## Create issues

Before you create an issue, check the [existing issues](https://github.com/AssemblyAI/assemblyai-node-sdk/issues) to see if someone's already created a similar one.

- If you find an existing issue, add any relevant information and upvote the issue using a thumb-up emoji (👍).
- If you don't find an issue, [create an issue](https://github.com/AssemblyAI/assemblyai-node-sdk/issues/new) so we can help you, and discuss solutions and next steps.

## Submit a PR

Before submitting a PR, to avoid wasting your valuable time, make sure you are aligned with the maintainers of the repository by discussing the desired changes in a GitHub issue.

To make changes, follow these steps:

1. Fork the repository and clone your own fork.
2. [Set up pnpm](https://pnpm.io/installation).
3. Run `pnpm install`.
4. Make your changes.

- Make the changes themselves.
- Add tests that verify your changes.
- Describe your changes in [CHANGELOG.md](./CHANGELOG.md).

1. Before committing your changes, run the following scripts:
   - `pnpm format`
   - `pnpm lint`
   - `pnpm test` (see [run integration tests](#run-integration-tests))
   - `pnpm build`
2. If linting and testing passes, commit your changes.
3. Submit your PR.

## Run integration tests

The integration tests require an upgraded AssemblyAI account.
The integration tests will use the AssemblyAI API and you'll be charged for your usage.
Reach out to us if you want some credits for running integration tests.

The integration tests require the following environment variables:

- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key
- `TEST_TRANSCRIPT_ID`: The transcript ID of a completed transcript your created
- `TEST_TRANSCRIPT_IDS`: One or more completed transcript IDs, separated by a comma `,`

You can set these environment variables in your shell, or by creating a _.env_ file with the following format:

```plaintext
ASSEMBLYAI_API_KEY=...
TEST_TRANSCRIPT_ID=...
TEST_TRANSCRIPT_IDS=...
```

## Generate types from OpenAPI and AsyncAPI spec

1. Configure the location of the OpenAPI and AsyncAPI spec as environment variables:
   - `OPENAPI_SPEC`: Path or URL to the AssemblyAI OpenAPI spec
   - `ASYNCAPI_SPEC`: Path or URL to the AssemblyAI AsyncAPI spec

2. Generate the types using `pnpm generate:types`.

## Notes about the JavaScript SDK

### Rollup

We use Rollup to build the JavaScript SDK.
Our Rollup configuration generates the following versions:

- node.{cjs,mjs}: The Node runtime version using CommonJS and ESModule syntax.
- bun.mjs: The Bun runtime version.
- deno.mjs: The Deno runtime version.
- browser: The browser runtime version that uses the native WebSocket instead of `ws`.
  - browser.mjs: Using ESModule syntax, to be used by users using a bundler.
  - assemblyai.umd?(.min).js: Using UMD syntax which creates, to be used directly from a script tag.
    This script adds the SDK to the global `assemblyai` variable.
- index.cjs: The default version using CommonJS syntax.
- index.mjs: The default version using ESModule syntax.
- index.d.ts: The TypeScript types for the SDK.

### Package.json exports

When a user uses the SDK, the users' runtime will automatically choose the runtime-specific version
if defined in the package.json `exports` object, or fall back to the default version.

For example, Bun will use _bun.mjs_ and Cloudflare Workers (workerd) will use _index.mjs_.

### Package.json imports

To make the SDK compatible with a variety of runtimes, we have to polyfill certain features.
We're doing this using package.json `imports`, which lets you define runtime-specific imports.
When these imports are TypeScript files, Rollup automatically includes the code in the output for the specified runtime.

When they are ordinary JavaScript files, Rollup leaves the private import in the output as is.
This works fine in most runtimes, but some runtimes like React Native/Expo do not support this.
Therefore, we should restrict ourselves to using only TypeScript code with package.json imports.
