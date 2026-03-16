import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Cleanup job: Delete postings older than 2 months
  cron.schedule("0 0 * * *", async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const { error } = await supabaseAdmin
        .from("listings")
        .delete()
        .lt("created_at", twoMonthsAgo.toISOString());
      
      if (error) {
        console.error("Error deleting old postings:", error);
      } else {
        console.log("Old postings deleted successfully.");
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
