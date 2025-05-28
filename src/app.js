import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));

// for parsing json body
app.use(express.json({ limit: "16kb" }));
// for parsing url encoded body
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
// serve static folder/files
app.use(express.static("public"));
// accessing cookie and performing CRUD op. on cookiee
app.use(cookieParser());

// routes import
import userRouter from "./routes/user.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
// routes declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/tweet", tweetRouter);
export { app };