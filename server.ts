// @ts-expect-error dist/index.js dibuat otomatis saat proses build
import { createApp } from "./dist/index.js";

const app = createApp();

export default app;
