```ts
import express from "express";

// @ts-ignore
import { createApp } from "./dist/index.js";

const app = express.default();
app.use(createApp());

export default app;
```
