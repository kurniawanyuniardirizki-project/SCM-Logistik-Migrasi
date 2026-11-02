import express from "express";
import { createApp } from "./dist/index.js";

const app = express();
app.use(createApp());

export default app;
