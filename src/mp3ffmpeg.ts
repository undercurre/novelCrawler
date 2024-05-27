import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

// 如果需要，显式设置ffmpeg和ffprobe的路径
ffmpeg.setFfmpegPath(
  "D:\\ffmpeg\\ffmpeg-7.0-essentials_build\\ffmpeg-7.0-essentials_build\\bin\\ffmpeg"
);
ffmpeg.setFfprobePath(
  "D:\\ffmpeg\\ffmpeg-7.0-essentials_build\\ffmpeg-7.0-essentials_build\\bin\\ffprobe"
);

const dirName = "101-104";

// 指定音频文件所在的目录
const audioDir = `./mp3s/${dirName}`;
// 输出文件路径
const outputFile = `${dirName}.mp3`;

// 获取目录中的所有MP3文件
const getAllAudioFiles = (dir: string): string[] => {
  return fs
    .readdirSync(dir)
    .filter((file) => path.extname(file).toLowerCase() === ".mp3")
    .sort((a, b) => {
      const [a1, a2] = a.split("_").map(Number);
      const [b1, b2] = b.split("_").map(Number);
      return a1 === b1 ? a2 - b2 : a1 - b1;
    })
    .map((file) => path.join(dir, file));
};

// 检查输入文件是否存在
const inputFiles = getAllAudioFiles(audioDir);

console.log(inputFiles);

if (inputFiles.length === 0) {
  console.error("No MP3 files found in the directory");
  process.exit(1);
}

// 创建一个新的ffmpeg命令
const command = ffmpeg();

// 将每个输入文件添加到ffmpeg命令中
inputFiles.forEach((file) => {
  command.input(file);
});

// 设置输出文件格式和路径
command
  .on("start", (commandLine) => {
    console.log(`Spawned Ffmpeg with command: ${commandLine}`);
  })
  .on("error", (err, stdout, stderr) => {
    console.error(`Error: ${err.message}`);
    console.error(`ffmpeg stderr: ${stderr}`);
  })
  .on("end", () => {
    console.log("File has been converted successfully");
  })
  .mergeToFile(outputFile, "./tmp"); // 设置临时目录
