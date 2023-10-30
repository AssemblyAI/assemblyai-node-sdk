# Changelog

## [3.0.1] - 2023-10-30
### Changed
- The SDK uses `fetch` instead of Axios. This removes the Axios dependency. Axios relies on XMLHttpRequest which isn't supported in Cloudflare Workers, Deno, Bun, etc. By using `fetch`, the SDK is now more compatible on the forementioned runtimes.

### Fixed
- The SDK uses relative imports instead of using path aliases, to make the library transpilable with tsc for consumers. Fixes [#14](https://github.com/AssemblyAI/assemblyai-node-sdk/issues/14).
- Added `speaker` property to the `TranscriptUtterance` type, and removed `channel` property.

## [3.0.0] - 2023-10-24
### Changed
- `AssemblyAI.files.upload` accepts streams and buffers, in addition to a string (path to file).

### Removed
- **Breaking**: The module does not have a default export anymore, because of inconsistent functionality across module systems. Instead, use `AssemblyAI` as a named import like this: `import { AssemblyAI } from 'assemblyai'`.

## [2.0.2] - 2023-10-13

### Added
- `AssemblyAI.transcripts.wordSearch` searches for keywords in the transcript.
- `AssemblyAI.lemur.purgeRequestData` deletes data related to your LeMUR request.
- `RealtimeService.stream` creates a writable stream that you can write audio data to instead of using `RealtimeService.sendAudio``.

### Fixed
- The AssemblyAI class would be exported as default named export instead in certain module systems.

## [2.0.1] - 2023-10-10

Re-implement the Node SDK in TypeScript and add all AssemblyAI APIs.

### Added
- Transcript API client
- LeMUR API client
- Real-time transcript client
