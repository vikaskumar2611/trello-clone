import dotenv from "dotenv/config.js";
//dotenv.config();

import { connectDB } from "./database/db.js";
import { app } from "./app.js";

// Connect to PostgreSQL first, then start server
connectDB()
    .then(() => {
        app.listen(process.env.PORT || 5000, () => {
            console.log(
                `Server is running on port: ${process.env.PORT || 5000}`,
            );
        });
    })
    .catch((err) => {
        console.error("PostgreSQL connection failed:", err);
        process.exit(1);
    });
