const express = require("express");
const multer = require("multer");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const app = express();

// Set up static folder for the frontend
app.use(express.static("public"));

// Set up multer for file uploads
const upload = multer({ dest: "uploads/" });

// Video processing route
app.post("/process", upload.single("video"), (req, res) => {
  const inputFilePath = req.file.path;
  const outputFilePath = `outputs/${Date.now()}-output.mp4`;

  res.setHeader("Content-Type", "application/json");

  const command = ffmpeg(inputFilePath)
    .output(outputFilePath)
    .on("progress", (progress) => {
      // Round progress percentage to two decimal places
      const roundedProgress = Math.round(progress.percent * 100) / 100;
      console.log("Processing: " + roundedProgress + "% done");
      res.write(JSON.stringify({ progress: roundedProgress }));
    })
    .on("end", () => {
      console.log("Processing complete. Sending file...");
      res.write(JSON.stringify({ message: "completed" }));
      res.end(() => {
        // Ensure file is still available after process completes
        console.log("File processing completed.");
        // Clean up input file after processing
        fs.unlinkSync(inputFilePath);
      });
    })
    .on("error", (err) => {
      console.error("Error during processing:", err);
      res.status(500).send(JSON.stringify({ error: "Error processing video" }));
    });

  command.run();
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
