import express from "express";
import { createApp } from "./server/_core/index";

const app = express();
app.use(createApp());

export default app;
