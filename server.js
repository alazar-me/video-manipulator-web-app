const express = require("express");
const multer = require("multer");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const stegcloak = require("stegcloak");
const exiftool = require("exiftool-vendored").exiftool;
const { exec } = require("child_process");
const app = express();

// Set up static folder for the frontend
app.use(express.static("public"));

// Set up multer for file uploads
const upload = multer({ dest: "uploads/" });

// Video processing route
app.post("/process", upload.single("video"), async (req, res) => {
  const inputFilePath = req.file.path;
  const outputFilePath = `outputs/${Date.now()}-output.mkv`;
  const inaudibleAudioPath = path.join(__dirname, "inaudible.mp4");
  const hiddenFilePath = path.join(__dirname, "hidden.txt"); // Path to your hidden data file

  console.log(`Processing video: ${inputFilePath}`);

  res.setHeader("Content-Type", "application/json");

  try {
    // Process video to change frame rate, scale, brightness/contrast, and apply manipulations
    await new Promise((resolve, reject) => {
      ffmpeg(inputFilePath)
        .output(outputFilePath)
        .audioCodec("aac")
        .audioBitrate("128k")
        .audioChannels(2)
        .videoCodec("libx264")
        .format("matroska") // Convert to .mkv
        .audioFilters("asetrate=44100*1.01") // Change pitch slightly
        .videoFilters([
          "fps=29.97", // Change frame rate
          "scale=iw*0.999:ih*0.999", // Slightly reduce video resolution
          "eq=brightness=0.01:contrast=1.01", // Slight brightness and contrast adjustment
        ])
        .on("start", (commandLine) => {
          console.log(`FFmpeg command: ${commandLine}`);
        })
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Embed hidden file into the video (using stegcloak)
    await new Promise((resolve, reject) => {
      const stegcloakInstance = new stegcloak();
      stegcloakInstance
        .hide(hiddenFilePath, outputFilePath, "supersecret", true)
        .then(() => {
          console.log("Hidden text embedded");
          resolve();
        })
        .catch((err) => {
          console.error("Error embedding file:", err);
          reject(err);
        });
    });

    // Merge inaudible audio with the processed video
    const mergedOutputPath = `outputs/${Date.now()}-merged-output.mkv`;
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(outputFilePath)
        .input(inaudibleAudioPath)
        .output(mergedOutputPath)
        .audioCodec("aac")
        .on("end", () => {
          // Clean up intermediate files
          fs.unlinkSync(inputFilePath);
          fs.unlinkSync(outputFilePath);
          resolve();
        })
        .on("error", (err) => {
          console.error("Error merging audio:", err);
          reject(err);
        })
        .run();
    });

    // Manipulate metadata using exiftool
    await new Promise((resolve, reject) => {
      exiftool
        .write(mergedOutputPath, {
          Title: "Experiment Video",
          Artist: "Anonymous",
          Comment:
            "This video has been processed to be different from its original.",
          Software: "Custom Video Manipulator",
        })
        .then(() => {
          console.log("Metadata updated successfully");
          resolve();
        })
        .catch((err) => {
          console.error("Error updating metadata:", err);
          reject(err);
        });
    });

    res.send(
      JSON.stringify({ message: "Processing complete", file: mergedOutputPath })
    );
  } catch (err) {
    console.error("Error during processing:", err);
    res.status(500).send(JSON.stringify({ error: "Error processing video" }));
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
