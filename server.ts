import express from "express";
import { createApp } from "./server/_core/index.js";

const app = express();
app.use(createApp());

export default app;
