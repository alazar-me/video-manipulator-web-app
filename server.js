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

// Pre-recorded inaudible sound file (replace with your .mp4 file)
const inaudibleAudioFile = path.join(__dirname, "inaudiable.mp3"); // Point to inaudiable.mp4

// Video processing route
app.post("/process", upload.single("video"), (req, res) => {
  const inputFilePath = req.file.path;
  const outputFilePath = `outputs/${Date.now()}-output.mkv`;

  console.log(`Processing video: ${inputFilePath}`);

  res.setHeader("Content-Type", "application/json");

  ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
    if (err) {
      console.error("Error reading metadata:", err);
      res.status(500).send(JSON.stringify({ error: "Error processing video" }));
      return;
    }

    const originalFps = metadata.streams
      .find((stream) => stream.codec_type === "video")
      .r_frame_rate.split("/");
    const frameRate = parseFloat(originalFps[0]) / parseFloat(originalFps[1]);
    const newFps = frameRate - 0.5; // Subtract 0.5 FPS

    console.log(`Original FPS: ${frameRate}, New FPS: ${newFps}`);

    const command = ffmpeg(inputFilePath)
      .output(outputFilePath)
      .videoCodec("libx264")
      .format("matroska") // Convert to .mkv
      .videoBitrate("1000k") // Adjust bitrate slightly
      .fps(newFps) // Dynamic frame rate adjustment
      .audioCodec("aac") // Change audio codec to AAC
      .audioBitrate("128k") // Adjust audio bitrate slightly
      .audioChannels(2) // Ensure audio has two channels
      .input(inaudibleAudioFile) // Input the inaudible sound file
      .complexFilter([
        "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=3", // Mix the original audio with the inaudible sound
      ])
      .size("1920x1080") // Keep original size (or adjust as needed)
      .outputOptions("-metadata", "title=Processed Video") // Modify metadata
      .on("start", (commandLine) => {
        // Log FFmpeg command being executed
        console.log(`FFmpeg command: ${commandLine}`);
      })
      .on("progress", (progress) => {
        const roundedProgress = Math.round(progress.percent * 100) / 100;
        console.log("Processing: " + roundedProgress + "% done");
        res.write(JSON.stringify({ progress: roundedProgress }));
      })
      .on("end", () => {
        console.log(`Processing complete. File saved as: ${outputFilePath}`);
        res.write(JSON.stringify({ message: "completed" }));
        res.end(() => {
          fs.unlinkSync(inputFilePath); // Clean up the input file
        });
      })
      .on("error", (err) => {
        console.error("Error during processing:", err);
        res
          .status(500)
          .send(JSON.stringify({ error: "Error processing video" }));
      });

    command.run();
  });
});

// Start  server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
