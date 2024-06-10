import fs from "fs";
import path from "path";

const dirName = "split";

// 指定文章文件所在的目录
const sourceDir = `./source`;

// 获取目录中的所有txt文件
const getAllAudioFiles = (dir: string): string[] => {
  return fs
    .readdirSync(dir)
    .filter((file) => path.extname(file).toLowerCase() === ".txt")
    .map((file) => path.join(dir, file));
};

// 检查输入文件是否存在
const inputFiles = getAllAudioFiles(sourceDir);

console.log(inputFiles);

if (inputFiles.length === 0) {
  console.error("空空如也");
  process.exit(1);
}

inputFiles.forEach((file, index) => {
  const content = fs.readFileSync(file);
  const parts = splitContent(content.toString(), 800);
  for (let i = 0; i < parts.length; i++) {
    const filePath = path.join(
      __dirname,
      `../${dirName}/${index + 1}_${i + 1}.docx`
    );
    fs.writeFileSync(filePath, parts[i], "utf8");
  }
});

// 将内容分割成指定长度的段落
function splitContent(content: string, maxLength: number): string[] {
  const parts = [];
  for (let i = 0; i < content.length; i += maxLength) {
    parts.push(content.slice(i, i + maxLength));
  }
  return parts;
}
