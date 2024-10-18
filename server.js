const express = require("express");
const multer = require("multer");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const exiftool = require("exiftool-vendored").exiftool;
const app = express();

// Set up static folder for the frontend
app.use(express.static("public"));

// Set up multer for file uploads
const upload = multer({ dest: "uploads/" });

// Video processing route
app.post("/process", upload.single("video"), async (req, res) => {
  const inputFilePath = req.file.path;
  const outputFilePath = `outputs/${Date.now()}-output.mkv`;
  const inaudibleAudioPath = path.join(__dirname, "inaudiable.mp3");

  console.log(`Processing video: ${inputFilePath}`);

  res.setHeader("Content-Type", "application/json");

  try {
    // Process video with multiple manipulations
    await new Promise((resolve, reject) => {
      ffmpeg(inputFilePath)
        .output(outputFilePath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .audioBitrate("128k")
        .audioChannels(2)
        .outputOptions([
          "-vf scale=iw*0.998:ih*0.998", // Slight rescaling
          "-vf eq=brightness=0.03:saturation=2.05:contrast=4.02", // Adjust video properties
          "-af asetrate=44100*1.02", // Audio pitch shift
          "-b:v 1500k", // Adjust video bitrate
          "-maxrate 1500k", // Max bitrate to avoid over-compression
          "-bufsize 1000k", // Buffer size for bitrate variability
          "-r 30", // Set framerate
          "-tune zerolatency", // Avoid buffer delay issues
          "-crf 23", // Apply slight compression
        ])
        .on("start", (commandLine) => {
          console.log(`FFmpeg command: ${commandLine}`);
        })
        .on("end", resolve)
        .on("error", (err, stdout, stderr) => {
          console.error("Error in ffmpeg processing:", err);
          console.error(stderr);
          reject(err);
        })
        .run();
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
        .on("error", (err, stdout, stderr) => {
          console.error("Error merging audio:", err);
          console.error(stderr);
          reject(err);
        })
        .run();
    });

    // Manipulate metadata using exiftool
    await new Promise((resolve, reject) => {
      exiftool
        .write(mergedOutputPath, {
          Title: "New Title",
          Artist: "New Artist",
          Comment: "This video has been manipulated.",
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
