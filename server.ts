import express from "express";

// @ts-ignore — dist/index.js dibuat otomatis saat build
import { createApp } from "./dist/index.js";

const app = express();
app.use(createApp());

export default app;
